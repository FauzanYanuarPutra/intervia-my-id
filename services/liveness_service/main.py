from __future__ import annotations

import asyncio
import io
import logging
import os
import time
import uuid
import warnings
from contextlib import asynccontextmanager
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from liveness_model import FaceBox, LivenessPredictor

SERVICE_NAME = "lajukan-liveness-service"
SERVICE_VERSION = "2.0.0"

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(SERVICE_NAME)


def env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


MAX_UPLOAD_BYTES = env_int(
    "LIVENESS_MAX_UPLOAD_BYTES",
    6 * 1024 * 1024,
    256 * 1024,
    20 * 1024 * 1024,
)
MAX_IMAGE_PIXELS = env_int(
    "LIVENESS_MAX_IMAGE_PIXELS",
    12_000_000,
    500_000,
    40_000_000,
)
MAX_CONCURRENT = env_int("LIVENESS_MAX_CONCURRENT", 1, 1, 4)
QUEUE_TIMEOUT_SEC = env_float("LIVENESS_QUEUE_TIMEOUT_SEC", 5.0, 0.5, 30.0)

LIVENESS_THRESHOLD = env_float("LIVENESS_THRESHOLD", 0.90, 0.50, 0.999)
MIN_FACE_COVERAGE = env_float("LIVENESS_MIN_FACE_COVERAGE", 0.075, 0.02, 0.40)
MAX_FACE_COVERAGE = env_float("LIVENESS_MAX_FACE_COVERAGE", 0.70, 0.20, 0.95)
MIN_BLUR_VARIANCE = env_float("LIVENESS_MIN_BLUR_VARIANCE", 55.0, 5.0, 1000.0)
MIN_BRIGHTNESS = env_float("LIVENESS_MIN_BRIGHTNESS", 45.0, 0.0, 150.0)
MAX_BRIGHTNESS = env_float("LIVENESS_MAX_BRIGHTNESS", 220.0, 100.0, 255.0)
MAX_CENTER_OFFSET = env_float("LIVENESS_MAX_CENTER_OFFSET", 0.38, 0.10, 0.80)

YUNET_MODEL = Path(
    os.getenv(
        "LIVENESS_FACE_DETECTOR_MODEL",
        "./resources/face_detection_yunet_2026may.onnx",
    )
)
MODEL_DIR = os.getenv(
    "LIVENESS_MODEL_DIR",
    "./resources/anti_spoof_models",
)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/octet-stream",
}

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT)


@dataclass(frozen=True)
class DetectedFace:
    box: FaceBox
    score: float
    detector: str
    landmarks: list[list[float]] | None = None


class FaceDetector:
    def __init__(self) -> None:
        self.backend = "haar"
        self.yunet: Any = None
        self.error: str | None = None

        if YUNET_MODEL.is_file() and hasattr(cv2, "FaceDetectorYN"):
            try:
                self.yunet = cv2.FaceDetectorYN.create(
                    str(YUNET_MODEL),
                    "",
                    (320, 320),
                    0.80,
                    0.30,
                    5000,
                )
                self.backend = "yunet"
            except Exception as exc:
                self.error = f"YuNet init failed: {type(exc).__name__}: {exc}"
                logger.warning(self.error)

        self.haar = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        if self.haar.empty():
            raise RuntimeError("OpenCV Haar face detector could not be loaded")

    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        if self.yunet is not None:
            faces = self._detect_yunet(image)
            if faces:
                return faces

        return self._detect_haar(image)

    def _detect_yunet(self, image: np.ndarray) -> list[DetectedFace]:
        height, width = image.shape[:2]
        self.yunet.setInputSize((width, height))
        _, rows = self.yunet.detect(image)

        if rows is None:
            return []

        output: list[DetectedFace] = []
        for row in rows:
            x, y, w, h = [int(round(float(value))) for value in row[:4]]
            score = float(row[-1])
            if w <= 0 or h <= 0:
                continue

            landmarks = []
            # YuNet returns five landmarks after bbox.
            for index in range(4, min(14, len(row) - 1), 2):
                landmarks.append(
                    [round(float(row[index]), 2), round(float(row[index + 1]), 2)]
                )

            output.append(
                DetectedFace(
                    box=clip_box(FaceBox(x, y, w, h), width, height),
                    score=max(0.0, min(1.0, score)),
                    detector="yunet",
                    landmarks=landmarks or None,
                )
            )

        return sorted(
            output,
            key=lambda item: item.box.w * item.box.h,
            reverse=True,
        )

    def _detect_haar(self, image: np.ndarray) -> list[DetectedFace]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        rows = self.haar.detectMultiScale(
            gray,
            scaleFactor=1.08,
            minNeighbors=6,
            minSize=(72, 72),
        )

        height, width = image.shape[:2]
        output = [
            DetectedFace(
                box=clip_box(
                    FaceBox(int(x), int(y), int(w), int(h)),
                    width,
                    height,
                ),
                score=1.0,
                detector="haar",
                landmarks=None,
            )
            for x, y, w, h in rows
            if w > 0 and h > 0
        ]

        return sorted(
            output,
            key=lambda item: item.box.w * item.box.h,
            reverse=True,
        )


class Runtime:
    def __init__(self) -> None:
        self.predictor: LivenessPredictor | None = None
        self.face_detector: FaceDetector | None = None
        self.state = "starting"
        self.error: str | None = None
        self.init_ms: int | None = None

    @property
    def ready(self) -> bool:
        return (
            self.state == "ready"
            and self.predictor is not None
            and self.predictor.ready
            and self.face_detector is not None
        )

    def initialize(self) -> None:
        started = time.perf_counter()
        try:
            self.face_detector = FaceDetector()
            self.predictor = LivenessPredictor(MODEL_DIR)

            if not self.predictor.ready:
                self.state = "not_ready"
                self.error = self.predictor.error or "Anti-spoof model is unavailable"
            else:
                self.state = "ready"
                self.error = self.predictor.error
        except Exception as exc:
            self.state = "failed"
            self.error = f"{type(exc).__name__}: {exc}"
            logger.exception("Liveness runtime initialization failed")
        finally:
            self.init_ms = round((time.perf_counter() - started) * 1000)

        logger.info(
            "runtime state=%s models=%s face_detector=%s init_ms=%s",
            self.state,
            self.predictor.model_names if self.predictor else [],
            self.face_detector.backend if self.face_detector else None,
            self.init_ms,
        )


runtime = Runtime()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_in_threadpool(runtime.initialize)
    yield


app = FastAPI(
    title="Lajukan Liveness Service",
    version=SERVICE_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


def package_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


def request_id_from(request: Request) -> str:
    value = request.headers.get("x-request-id", "").strip()
    return value[:128] if value else f"liv-{uuid.uuid4().hex}"


def response(
    body: dict[str, Any],
    request_id: str,
    status_code: int = 200,
) -> JSONResponse:
    body.setdefault("request_id", request_id)
    result = JSONResponse(body, status_code=status_code)
    result.headers["x-request-id"] = request_id
    result.headers["Cache-Control"] = "no-store"
    return result


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "runtime_state": runtime.state,
    }


@app.get("/ready")
async def ready() -> JSONResponse:
    body: dict[str, Any] = {
        "status": "ready" if runtime.ready else "not_ready",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "runtime_state": runtime.state,
        "init_ms": runtime.init_ms,
        "threshold": LIVENESS_THRESHOLD,
        "face_detector": (
            runtime.face_detector.backend
            if runtime.face_detector is not None
            else None
        ),
        "models": (
            runtime.predictor.model_names
            if runtime.predictor is not None
            else []
        ),
    }

    if runtime.error:
        body["reason"] = runtime.error[:800]

    return JSONResponse(
        body,
        status_code=200 if runtime.ready else 503,
    )


@app.get("/capabilities")
async def capabilities() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "mode": "passive_single_image_pad",
        "input": {
            "field": "file",
            "mime_types": sorted(
                ALLOWED_CONTENT_TYPES - {"application/octet-stream"}
            ),
            "max_bytes": MAX_UPLOAD_BYTES,
            "max_pixels": MAX_IMAGE_PIXELS,
        },
        "decision": {
            "threshold": LIVENESS_THRESHOLD,
            "fail_closed_without_model": True,
            "quality_heuristics_can_mark_real": False,
        },
        "runtime": {
            "models": runtime.predictor.model_names if runtime.predictor else [],
            "face_detector": (
                runtime.face_detector.backend if runtime.face_detector else None
            ),
            "onnxruntime": package_version("onnxruntime"),
            "opencv": package_version("opencv-python-headless"),
        },
    }


def clip_box(box: FaceBox, width: int, height: int) -> FaceBox:
    x1 = max(0, min(width - 1, box.x))
    y1 = max(0, min(height - 1, box.y))
    x2 = max(x1 + 1, min(width, box.x + box.w))
    y2 = max(y1 + 1, min(height, box.y + box.h))
    return FaceBox(x1, y1, x2 - x1, y2 - y1)


async def read_upload_limited(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    chunk_size = 1024 * 1024

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "IMAGE_TOO_LARGE",
                    "message": f"Image exceeds {MAX_UPLOAD_BYTES} bytes.",
                },
            )
        chunks.append(chunk)

    if total == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "EMPTY_FILE", "message": "Uploaded image is empty."},
        )

    return b"".join(chunks)


def decode_image(contents: bytes) -> np.ndarray:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(contents))
            image = ImageOps.exif_transpose(image)
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombWarning) as exc:
        raise ValueError(f"invalid_image: {exc}") from exc

    width, height = image.size
    if width < 160 or height < 160:
        raise ValueError("image_too_small")
    if width * height > MAX_IMAGE_PIXELS:
        raise ValueError("image_pixel_limit_exceeded")

    rgb = np.asarray(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def face_quality(
    frame: np.ndarray,
    face: DetectedFace,
) -> dict[str, Any]:
    height, width = frame.shape[:2]
    box = face.box
    face_area_ratio = float((box.w * box.h) / max(width * height, 1))

    crop = frame[box.y : box.y2, box.x : box.x2]
    if crop.size == 0:
        raise ValueError("empty_face_crop")

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    glare_ratio = float(np.mean(gray >= 248))

    image_center_x = width / 2.0
    image_center_y = height / 2.0
    face_center_x = box.x + box.w / 2.0
    face_center_y = box.y + box.h / 2.0

    center_dx = abs(face_center_x - image_center_x) / max(width / 2.0, 1.0)
    center_dy = abs(face_center_y - image_center_y) / max(height / 2.0, 1.0)
    center_offset = float((center_dx**2 + center_dy**2) ** 0.5 / (2**0.5))

    failures: list[str] = []
    warnings_out: list[str] = []

    if face_area_ratio < MIN_FACE_COVERAGE:
        failures.append("FACE_TOO_SMALL")
    elif face_area_ratio > MAX_FACE_COVERAGE:
        failures.append("FACE_TOO_CLOSE")

    if brightness < MIN_BRIGHTNESS:
        failures.append("IMAGE_TOO_DARK")
    elif brightness > MAX_BRIGHTNESS:
        failures.append("IMAGE_TOO_BRIGHT")

    if blur_variance < MIN_BLUR_VARIANCE:
        failures.append("IMAGE_TOO_BLURRY")

    if center_offset > MAX_CENTER_OFFSET:
        failures.append("FACE_OFF_CENTER")

    if contrast < 22:
        warnings_out.append("LOW_CONTRAST")
    if glare_ratio > 0.12:
        warnings_out.append("GLARE_DETECTED")

    score = 1.0
    score -= min(0.35, max(0.0, (MIN_BLUR_VARIANCE - blur_variance) / max(MIN_BLUR_VARIANCE, 1.0)) * 0.35)
    if brightness < MIN_BRIGHTNESS:
        score -= 0.20
    elif brightness > MAX_BRIGHTNESS:
        score -= 0.15
    if face_area_ratio < MIN_FACE_COVERAGE or face_area_ratio > MAX_FACE_COVERAGE:
        score -= 0.25
    if center_offset > MAX_CENTER_OFFSET:
        score -= 0.15
    if glare_ratio > 0.12:
        score -= 0.10

    return {
        "passed": not failures,
        "score": round(max(0.0, min(1.0, score)), 4),
        "failures": failures,
        "warnings": warnings_out,
        "face_coverage": round(face_area_ratio, 6),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "blur_variance": round(blur_variance, 2),
        "glare_ratio": round(glare_ratio, 4),
        "center_offset": round(center_offset, 4),
    }


def capture_failure_payload(
    error_code: str,
    message: str,
    frame: np.ndarray,
    face_count: int,
    face: DetectedFace | None = None,
    quality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    height, width = frame.shape[:2]
    coverage = (
        quality.get("face_coverage", 0.0)
        if quality is not None
        else 0.0
    )

    return {
        "status": "success",
        "is_real": False,
        "liveness_score": 0.0,
        "verdict": "RETRY_CAPTURE",
        "error_code": error_code,
        "message": message,
        "metadata": {
            "face_detected": face is not None,
            "face_count": face_count,
            "face_coverage": coverage,
            "threshold_used": LIVENESS_THRESHOLD,
            "resolution": f"{width}x{height}",
            "face_detector": face.detector if face else (
                runtime.face_detector.backend if runtime.face_detector else None
            ),
            "capture_quality": quality,
        },
    }


def perform_check(frame: np.ndarray) -> dict[str, Any]:
    if runtime.face_detector is None:
        raise RuntimeError("Face detector is unavailable")
    if runtime.predictor is None or not runtime.predictor.ready:
        raise RuntimeError(
            runtime.predictor.error
            if runtime.predictor is not None
            else "Anti-spoof model is unavailable"
        )

    faces = runtime.face_detector.detect(frame)

    if not faces:
        return capture_failure_payload(
            "NO_FACE_DETECTED",
            "Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.",
            frame,
            face_count=0,
        )

    if len(faces) > 1:
        return capture_failure_payload(
            "MULTIPLE_FACES_DETECTED",
            "Terdeteksi lebih dari satu wajah. Pastikan hanya satu orang di dalam frame.",
            frame,
            face_count=len(faces),
            face=faces[0],
        )

    face = faces[0]
    quality = face_quality(frame, face)

    if not quality["passed"]:
        first_failure = quality["failures"][0] if quality["failures"] else "LOW_CAPTURE_QUALITY"
        messages = {
            "FACE_TOO_SMALL": "Wajah terlalu jauh. Dekatkan wajah ke kamera.",
            "FACE_TOO_CLOSE": "Wajah terlalu dekat. Mundurkan kamera sedikit.",
            "IMAGE_TOO_DARK": "Pencahayaan terlalu gelap. Tambahkan cahaya dari arah depan.",
            "IMAGE_TOO_BRIGHT": "Pencahayaan terlalu terang. Hindari cahaya langsung ke kamera.",
            "IMAGE_TOO_BLURRY": "Gambar terlalu buram. Tahan kamera dan wajah agar lebih stabil.",
            "FACE_OFF_CENTER": "Posisikan wajah lebih dekat ke tengah frame.",
        }

        return capture_failure_payload(
            first_failure,
            messages.get(first_failure, "Kualitas foto belum cukup. Ambil ulang foto."),
            frame,
            face_count=1,
            face=face,
            quality=quality,
        )

    prediction = runtime.predictor.predict(frame, face.box)
    score = round(float(prediction.real_probability), 6)
    is_real = bool(score >= LIVENESS_THRESHOLD)

    height, width = frame.shape[:2]

    return {
        "status": "success",
        "is_real": is_real,
        # Compatibility field consumed by ai_service.
        "liveness_score": score,
        "verdict": "REAL" if is_real else "SPOOF_SUSPECTED",
        "error_code": None if is_real else "PRESENTATION_ATTACK_SUSPECTED",
        "message": (
            "Liveness check passed."
            if is_real
            else "Capture terindikasi sebagai presentation attack. Ambil ulang capture langsung dari kamera."
        ),
        "metadata": {
            "face_detected": True,
            "face_count": 1,
            "face_coverage": quality["face_coverage"],
            "threshold_used": LIVENESS_THRESHOLD,
            "resolution": f"{width}x{height}",
            "face_detector": face.detector,
            "face_detection_score": round(face.score, 6),
            "capture_quality": quality,
            "model_count": prediction.model_count,
            "model_scores": [
                {
                    "model": item.model,
                    "real_probability": item.real_probability,
                }
                for item in prediction.model_scores
            ],
        },
    }


@app.post("/check")
async def check_liveness(
    request: Request,
    file: UploadFile = File(...),
) -> JSONResponse:
    request_id = request_id_from(request)
    started = time.perf_counter()

    if not runtime.ready:
        return response(
            {
                "status": "error",
                "is_real": False,
                "liveness_score": 0.0,
                "error_code": "LIVENESS_MODEL_UNAVAILABLE",
                "message": "Liveness model belum siap.",
            },
            request_id,
            status_code=503,
        )

    content_type = (file.content_type or "").strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        return response(
            {
                "status": "error",
                "is_real": False,
                "liveness_score": 0.0,
                "error_code": "UNSUPPORTED_IMAGE_TYPE",
                "message": f"Unsupported image content type: {content_type}",
            },
            request_id,
            status_code=415,
        )

    try:
        contents = await read_upload_limited(file)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return response(
            {
                "status": "error",
                "is_real": False,
                "liveness_score": 0.0,
                "error_code": detail.get("error", "UPLOAD_ERROR"),
                "message": detail.get("message", "Upload gagal."),
            },
            request_id,
            status_code=exc.status_code,
        )
    finally:
        await file.close()

    try:
        frame = await run_in_threadpool(decode_image, contents)
    except ValueError as exc:
        return response(
            {
                "status": "error",
                "is_real": False,
                "liveness_score": 0.0,
                "error_code": "INVALID_IMAGE",
                "message": str(exc),
            },
            request_id,
            status_code=400,
        )

    acquired = False
    try:
        try:
            await asyncio.wait_for(
                inference_semaphore.acquire(),
                timeout=QUEUE_TIMEOUT_SEC,
            )
            acquired = True
        except asyncio.TimeoutError:
            return response(
                {
                    "status": "error",
                    "is_real": False,
                    "liveness_score": 0.0,
                    "error_code": "LIVENESS_BUSY",
                    "message": "Liveness service sedang penuh. Coba lagi sebentar.",
                },
                request_id,
                status_code=429,
            )

        result = await run_in_threadpool(perform_check, frame)
        result["latency_ms"] = round((time.perf_counter() - started) * 1000)
        return response(result, request_id)

    except Exception as exc:
        logger.exception("Liveness inference failed request_id=%s", request_id)
        return response(
            {
                "status": "error",
                "is_real": False,
                "liveness_score": 0.0,
                "error_code": "LIVENESS_INFERENCE_FAILED",
                "message": "Liveness inference gagal.",
            },
            request_id,
            status_code=500,
        )
    finally:
        if acquired:
            inference_semaphore.release()
