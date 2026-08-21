from __future__ import annotations

import math
import os
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


def _parse_float_list(value: str, fallback: tuple[float, ...]) -> tuple[float, ...]:
    try:
        result = tuple(float(part.strip()) for part in value.split(",") if part.strip())
    except ValueError:
        return fallback
    return result or fallback


@dataclass(frozen=True)
class FaceBox:
    x: int
    y: int
    w: int
    h: int

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h


@dataclass(frozen=True)
class ModelSpec:
    path: Path
    input_name: str
    input_height: int
    input_width: int
    layout: str
    scale: float


@dataclass(frozen=True)
class ModelScore:
    model: str
    real_probability: float


@dataclass(frozen=True)
class LivenessPrediction:
    real_probability: float
    model_scores: tuple[ModelScore, ...]
    model_count: int


class ModelConfigurationError(RuntimeError):
    pass


class LivenessPredictor:
    """
    Passive face presentation-attack detector backed by ONNX models.

    Important:
    - Image-quality heuristics are intentionally NOT used to declare a face live.
    - If no anti-spoof model is available, `ready` is False and callers must fail closed.
    - Multi-model directories are treated as an ensemble by averaging real-class
      probabilities.
    """

    def __init__(self, model_path: str | os.PathLike[str] | None = None):
        self.model_path = Path(
            model_path
            or os.getenv("LIVENESS_MODEL_DIR", "./resources/anti_spoof_models")
        )
        self.real_class = _env_int("LIVENESS_REAL_CLASS", 1, 0, 32)
        self.output_is_logits = _env_bool("LIVENESS_OUTPUT_IS_LOGITS", True)
        self.binary_output_is_real = _env_bool("LIVENESS_BINARY_OUTPUT_IS_REAL", True)
        self.color_order = os.getenv("LIVENESS_COLOR_ORDER", "BGR").strip().upper()
        if self.color_order not in {"BGR", "RGB"}:
            raise ModelConfigurationError("LIVENESS_COLOR_ORDER must be BGR or RGB")

        self.input_scale = _env_float("LIVENESS_INPUT_SCALE", 255.0, 1.0, 65535.0)
        self.input_mean = _parse_float_list(
            os.getenv("LIVENESS_INPUT_MEAN", "0,0,0"),
            (0.0, 0.0, 0.0),
        )
        self.input_std = _parse_float_list(
            os.getenv("LIVENESS_INPUT_STD", "1,1,1"),
            (1.0, 1.0, 1.0),
        )
        if len(self.input_mean) not in {1, 3} or len(self.input_std) not in {1, 3}:
            raise ModelConfigurationError(
                "LIVENESS_INPUT_MEAN and LIVENESS_INPUT_STD must contain 1 or 3 values"
            )
        if any(abs(value) < 1e-12 for value in self.input_std):
            raise ModelConfigurationError("LIVENESS_INPUT_STD cannot contain zero")

        self.intra_threads = _env_int(
            "LIVENESS_ORT_INTRA_OP_THREADS",
            2,
            1,
            16,
        )
        self.inter_threads = _env_int(
            "LIVENESS_ORT_INTER_OP_THREADS",
            1,
            1,
            8,
        )

        self._sessions: list[tuple[ort.InferenceSession, ModelSpec]] = []
        self._error: str | None = None
        self._lock = threading.Lock()
        self._load_models()

    @property
    def ready(self) -> bool:
        return bool(self._sessions)

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def model_names(self) -> list[str]:
        return [spec.path.name for _, spec in self._sessions]

    def _load_models(self) -> None:
        self._sessions.clear()
        self._error = None

        if self.model_path.is_file():
            model_files = [self.model_path]
        elif self.model_path.is_dir():
            model_files = sorted(self.model_path.glob("*.onnx"))
        else:
            self._error = f"Model path does not exist: {self.model_path}"
            return

        if not model_files:
            self._error = (
                f"No .onnx anti-spoof models found in {self.model_path}. "
                "Quality heuristics are not allowed to act as a liveness model."
            )
            return

        session_options = ort.SessionOptions()
        session_options.intra_op_num_threads = self.intra_threads
        session_options.inter_op_num_threads = self.inter_threads
        session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        session_options.log_severity_level = 3

        failures: list[str] = []

        for model_file in model_files:
            try:
                session = ort.InferenceSession(
                    str(model_file),
                    sess_options=session_options,
                    providers=["CPUExecutionProvider"],
                )
                spec = self._model_spec(session, model_file)
                self._sessions.append((session, spec))
            except Exception as exc:
                failures.append(f"{model_file.name}: {type(exc).__name__}: {exc}")

        if not self._sessions:
            self._error = "Unable to load anti-spoof model(s): " + "; ".join(failures)[:1200]
        elif failures:
            self._error = "Some anti-spoof models failed to load: " + "; ".join(failures)[:1200]

    def _model_spec(
        self,
        session: ort.InferenceSession,
        path: Path,
    ) -> ModelSpec:
        inputs = session.get_inputs()
        if len(inputs) != 1:
            raise ModelConfigurationError(
                f"{path.name}: expected one image input, found {len(inputs)}"
            )

        node = inputs[0]
        shape = list(node.shape)

        if len(shape) != 4:
            raise ModelConfigurationError(
                f"{path.name}: expected rank-4 image tensor, got {shape}"
            )

        layout: str
        height: int
        width: int

        # Prefer channel position when statically known.
        if shape[1] in {1, 3, 4}:
            layout = "NCHW"
            height = self._static_dim(shape[2], fallback=80)
            width = self._static_dim(shape[3], fallback=80)
        elif shape[3] in {1, 3, 4}:
            layout = "NHWC"
            height = self._static_dim(shape[1], fallback=80)
            width = self._static_dim(shape[2], fallback=80)
        else:
            # Silent-Face/MiniFASNet ONNX exports are usually NCHW.
            layout = os.getenv("LIVENESS_INPUT_LAYOUT", "NCHW").strip().upper()
            if layout not in {"NCHW", "NHWC"}:
                raise ModelConfigurationError(
                    "LIVENESS_INPUT_LAYOUT must be NCHW or NHWC"
                )
            if layout == "NCHW":
                height = self._static_dim(shape[2], fallback=80)
                width = self._static_dim(shape[3], fallback=80)
            else:
                height = self._static_dim(shape[1], fallback=80)
                width = self._static_dim(shape[2], fallback=80)

        filename_size = re.search(r"_(\d+)x(\d+)_", path.name)
        if filename_size:
            file_w = int(filename_size.group(1))
            file_h = int(filename_size.group(2))
            if file_w > 0 and file_h > 0:
                width = file_w
                height = file_h

        scale = self._scale_from_filename(path.name)

        return ModelSpec(
            path=path,
            input_name=node.name,
            input_height=height,
            input_width=width,
            layout=layout,
            scale=scale,
        )

    @staticmethod
    def _static_dim(value: Any, fallback: int) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return fallback
        return parsed if parsed > 0 else fallback

    @staticmethod
    def _scale_from_filename(filename: str) -> float:
        # Silent-Face model names frequently start with crop scale such as
        # `2.7_80x80_...`. If absent, use a conservative face-context crop.
        match = re.match(r"^([0-9]+(?:\.[0-9]+)?)_", filename)
        if not match:
            return _env_float("LIVENESS_CROP_SCALE", 1.35, 1.0, 4.0)
        try:
            return max(1.0, min(4.0, float(match.group(1))))
        except ValueError:
            return 1.35

    def predict(
        self,
        frame: np.ndarray,
        face_box: FaceBox,
    ) -> LivenessPrediction:
        if frame is None or frame.size == 0:
            raise ValueError("Empty frame")
        if not self.ready:
            raise RuntimeError(self._error or "Anti-spoof model is not ready")

        scores: list[ModelScore] = []

        with self._lock:
            for session, spec in self._sessions:
                crop = self._crop_face(frame, face_box, spec.scale)
                tensor = self._preprocess(crop, spec)
                outputs = session.run(None, {spec.input_name: tensor})
                probability = self._real_probability(outputs)
                scores.append(
                    ModelScore(
                        model=spec.path.name,
                        real_probability=round(probability, 8),
                    )
                )

        if not scores:
            raise RuntimeError("Anti-spoof ensemble produced no scores")

        real_probability = float(
            sum(item.real_probability for item in scores) / len(scores)
        )

        return LivenessPrediction(
            real_probability=max(0.0, min(1.0, real_probability)),
            model_scores=tuple(scores),
            model_count=len(scores),
        )

    @staticmethod
    def _crop_face(
        frame: np.ndarray,
        face_box: FaceBox,
        scale: float,
    ) -> np.ndarray:
        height, width = frame.shape[:2]

        cx = face_box.x + face_box.w / 2.0
        cy = face_box.y + face_box.h / 2.0

        target_w = face_box.w * scale
        target_h = face_box.h * scale

        x1 = max(0, int(round(cx - target_w / 2.0)))
        y1 = max(0, int(round(cy - target_h / 2.0)))
        x2 = min(width, int(round(cx + target_w / 2.0)))
        y2 = min(height, int(round(cy + target_h / 2.0)))

        if x2 <= x1 or y2 <= y1:
            raise ValueError("Invalid face crop")

        return frame[y1:y2, x1:x2]

    def _preprocess(
        self,
        crop: np.ndarray,
        spec: ModelSpec,
    ) -> np.ndarray:
        resized = cv2.resize(
            crop,
            (spec.input_width, spec.input_height),
            interpolation=cv2.INTER_LINEAR,
        )

        if self.color_order == "RGB":
            resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

        tensor = resized.astype(np.float32) / self.input_scale

        mean = np.asarray(self.input_mean, dtype=np.float32)
        std = np.asarray(self.input_std, dtype=np.float32)

        if mean.size == 1:
            mean = np.repeat(mean, 3)
        if std.size == 1:
            std = np.repeat(std, 3)

        if tensor.ndim == 3 and tensor.shape[2] >= 3:
            tensor[:, :, :3] = (tensor[:, :, :3] - mean[:3]) / std[:3]

        if spec.layout == "NCHW":
            tensor = np.transpose(tensor, (2, 0, 1))

        return np.ascontiguousarray(tensor[np.newaxis, ...], dtype=np.float32)

    def _real_probability(self, outputs: list[Any]) -> float:
        if not outputs:
            raise RuntimeError("Anti-spoof model returned no outputs")

        array = np.asarray(outputs[0], dtype=np.float32)
        if array.size == 0:
            raise RuntimeError("Anti-spoof model returned an empty output")

        # Remove batch dimensions without assuming exact export layout.
        values = array.reshape(-1)

        if values.size == 1:
            scalar = float(values[0])
            if self.output_is_logits:
                scalar = 1.0 / (1.0 + math.exp(-max(-60.0, min(60.0, scalar))))
            else:
                scalar = max(0.0, min(1.0, scalar))
            return scalar if self.binary_output_is_real else 1.0 - scalar

        if self.real_class >= values.size:
            raise ModelConfigurationError(
                f"LIVENESS_REAL_CLASS={self.real_class} but model output has "
                f"{values.size} classes"
            )

        if self.output_is_logits or not self._looks_like_probabilities(values):
            probabilities = self._softmax(values)
        else:
            probabilities = values / max(float(values.sum()), 1e-12)

        return float(probabilities[self.real_class])

    @staticmethod
    def _softmax(values: np.ndarray) -> np.ndarray:
        shifted = values - np.max(values)
        exp = np.exp(shifted)
        return exp / max(float(exp.sum()), 1e-12)

    @staticmethod
    def _looks_like_probabilities(values: np.ndarray) -> bool:
        if np.any(values < -1e-6) or np.any(values > 1.0 + 1e-6):
            return False
        total = float(values.sum())
        return 0.95 <= total <= 1.05
