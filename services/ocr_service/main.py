from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import threading
import time
import warnings
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from importlib import metadata
from typing import Any, Mapping, Sequence

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

SERVICE_NAME = "lajukan-ocr-service"
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


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default


OCR_LANG = os.getenv("OCR_LANG", "id").strip() or "id"
OCR_VERSION = os.getenv("OCR_VERSION", "PP-OCRv5").strip() or "PP-OCRv5"
OCR_DEVICE = os.getenv("OCR_DEVICE", "cpu").strip() or "cpu"

MAX_UPLOAD_BYTES = env_int("OCR_MAX_UPLOAD_BYTES", 8 * 1024 * 1024, 256 * 1024, 20 * 1024 * 1024)
MAX_IMAGE_PIXELS = env_int("OCR_MAX_IMAGE_PIXELS", 16_000_000, 1_000_000, 40_000_000)
MAX_SIDE = env_int("OCR_MAX_SIDE", 2200, 1000, 4096)
MIN_CARD_WIDTH = env_int("OCR_MIN_CARD_WIDTH", 1200, 640, 2400)
MAX_VARIANTS = env_int("OCR_MAX_VARIANTS", 3, 1, 4)
MAX_CONCURRENT = env_int("OCR_MAX_CONCURRENT", 1, 1, 4)
QUEUE_TIMEOUT_SEC = env_float("OCR_QUEUE_TIMEOUT_SEC", 5.0, 0.5, 30.0)
MIN_SEGMENT_CONFIDENCE = env_float("OCR_MIN_SEGMENT_CONFIDENCE", 0.35, 0.0, 0.95)
STRONG_MEAN_CONFIDENCE = env_float("OCR_STRONG_MEAN_CONFIDENCE", 0.78, 0.40, 0.99)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/bmp",
    "application/octet-stream",
}

# Avoid a decompression-bomb warning becoming an accidental DoS bypass.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

PaddleOCR = None
PADDLE_IMPORT_ERROR: str | None = None
try:
    from paddleocr import PaddleOCR as _PaddleOCR

    PaddleOCR = _PaddleOCR
except Exception as exc:  # pragma: no cover - depends on runtime image
    PADDLE_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


@dataclass
class Segment:
    text: str
    confidence: float
    box: list[list[float]] | None = None
    variant: str = "base"

    def public(self) -> dict[str, Any]:
        value = asdict(self)
        if value["box"] is None:
            value.pop("box")
        return value


@dataclass
class VariantResult:
    name: str
    segments: list[Segment]
    mean_confidence: float
    score: float
    nik_candidate: str | None
    nik_valid: bool


class OCRRuntime:
    def __init__(self) -> None:
        self.engine: Any = None
        self.state = "starting"
        self.error: str | None = None
        self.api = "unknown"
        self.init_ms: int | None = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self.engine is not None and self.state == "ready"

    def initialize(self) -> None:
        started = time.perf_counter()

        if PaddleOCR is None:
            self.state = "failed"
            self.error = PADDLE_IMPORT_ERROR or "PaddleOCR import failed"
            logger.error("PaddleOCR unavailable: %s", self.error)
            return

        # Primary config targets PaddleOCR 3.x. Fallbacks make startup tolerant
        # if a compatible older image is temporarily used during migration.
        candidates: list[dict[str, Any]] = [
            {
                "lang": OCR_LANG,
                "ocr_version": OCR_VERSION,
                "device": OCR_DEVICE,
                "use_doc_orientation_classify": False,
                "use_doc_unwarping": False,
                "use_textline_orientation": True,
            },
            {
                "lang": OCR_LANG,
                "ocr_version": OCR_VERSION,
                "device": OCR_DEVICE,
            },
            {
                "lang": OCR_LANG,
            },
            {
                "lang": OCR_LANG,
                "use_angle_cls": True,
                "use_gpu": False,
            },
        ]

        last_error: Exception | None = None
        for kwargs in candidates:
            try:
                logger.info("Initializing PaddleOCR with keys=%s", sorted(kwargs))
                self.engine = PaddleOCR(**kwargs)
                self.api = "predict" if hasattr(self.engine, "predict") else "legacy-ocr"
                self.state = "ready"
                self.error = None
                self.init_ms = round((time.perf_counter() - started) * 1000)
                logger.info(
                    "PaddleOCR ready api=%s lang=%s model=%s init_ms=%s",
                    self.api,
                    OCR_LANG,
                    OCR_VERSION,
                    self.init_ms,
                )
                return
            except Exception as exc:  # pragma: no cover - depends on Paddle version
                last_error = exc
                logger.warning(
                    "PaddleOCR init candidate failed (%s): %s",
                    sorted(kwargs),
                    exc,
                )

        self.state = "failed"
        self.error = f"{type(last_error).__name__}: {last_error}" if last_error else "unknown init error"
        self.init_ms = round((time.perf_counter() - started) * 1000)
        logger.error("PaddleOCR initialization failed: %s", self.error)

    def infer(self, image: np.ndarray, variant: str) -> list[Segment]:
        if not self.ready:
            raise RuntimeError(self.error or "OCR engine is not ready")

        # Paddle inference objects are not guaranteed to be thread-safe.
        with self._lock:
            if hasattr(self.engine, "predict"):
                try:
                    raw = list(self.engine.predict(image))
                    segments = parse_v3_output(raw, variant)
                    if segments:
                        return segments
                except Exception as exc:
                    # If this is a migration image that still exposes legacy .ocr,
                    # make one compatibility attempt before surfacing the failure.
                    if not hasattr(self.engine, "ocr"):
                        raise
                    logger.warning("PaddleOCR predict() failed, trying legacy ocr(): %s", exc)

            if hasattr(self.engine, "ocr"):
                try:
                    raw = self.engine.ocr(image, cls=True)
                except TypeError:
                    raw = self.engine.ocr(image)
                return parse_legacy_output(raw, variant)

        raise RuntimeError("Unsupported PaddleOCR runtime API")


runtime = OCRRuntime()
inference_semaphore = asyncio.Semaphore(MAX_CONCURRENT)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Finish one initialization attempt before marking the application started.
    # If initialization fails the API still starts in degraded mode, so /health
    # and /ready explain the failure instead of the container crash-looping.
    await run_in_threadpool(runtime.initialize)
    yield


app = FastAPI(
    title="Lajukan OCR Service",
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


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "engine_state": runtime.state,
    }


@app.get("/ready")
async def ready() -> JSONResponse:
    body = {
        "status": "ready" if runtime.ready else "not_ready",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "engine_state": runtime.state,
        "engine_api": runtime.api,
        "lang": OCR_LANG,
        "ocr_version": OCR_VERSION,
        "device": OCR_DEVICE,
        "init_ms": runtime.init_ms,
    }
    if runtime.error:
        # Keep it bounded; do not expose stack traces.
        body["reason"] = runtime.error[:500]
    return JSONResponse(body, status_code=200 if runtime.ready else 503)


@app.get("/capabilities")
async def capabilities() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "document_types": ["ktp"],
        "input": {
            "field": "file",
            "mime_types": sorted(ALLOWED_CONTENT_TYPES - {"application/octet-stream"}),
            "max_bytes": MAX_UPLOAD_BYTES,
            "max_pixels": MAX_IMAGE_PIXELS,
        },
        "ocr": {
            "lang": OCR_LANG,
            "ocr_version": OCR_VERSION,
            "device": OCR_DEVICE,
            "max_concurrent": MAX_CONCURRENT,
            "adaptive_variants": MAX_VARIANTS,
            "paddleocr_package": package_version("paddleocr"),
            "paddlepaddle_package": package_version("paddlepaddle"),
        },
    }


async def read_upload_limited(file: UploadFile) -> bytes:
    total = 0
    chunks: list[bytes] = []
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
    pixels = width * height

    if width < 80 or height < 80:
        raise ValueError("image_too_small")
    if pixels > MAX_IMAGE_PIXELS:
        raise ValueError("image_pixel_limit_exceeded")

    rgb = np.asarray(image.convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def resize_for_ocr(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)

    if longest > MAX_SIDE:
        scale = MAX_SIDE / float(longest)
        image = cv2.resize(
            image,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
        height, width = image.shape[:2]

    if width < MIN_CARD_WIDTH:
        scale = min(2.0, MIN_CARD_WIDTH / float(max(width, 1)))
        image = cv2.resize(
            image,
            (max(1, round(width * scale)), max(1, round(height * scale))),
            interpolation=cv2.INTER_CUBIC,
        )

    return image


def order_quad(points: np.ndarray) -> np.ndarray:
    points = points.astype(np.float32)
    ordered = np.zeros((4, 2), dtype=np.float32)
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).reshape(-1)
    ordered[0] = points[np.argmin(sums)]  # top-left
    ordered[2] = points[np.argmax(sums)]  # bottom-right
    ordered[1] = points[np.argmin(diffs)]  # top-right
    ordered[3] = points[np.argmax(diffs)]  # bottom-left
    return ordered


def warp_quad(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    tl, tr, br, bl = order_quad(quad)
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)

    width = max(1, int(max(width_a, width_b)))
    height = max(1, int(max(height_a, height_b)))

    destination = np.array(
        [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(np.array([tl, tr, br, bl]), destination)
    return cv2.warpPerspective(image, matrix, (width, height))


def try_rectify_ktp(image: np.ndarray) -> tuple[np.ndarray, bool]:
    """
    Conservative card rectification.

    Only warp a large quadrilateral whose aspect ratio resembles an ID card.
    This avoids turning a random background contour into a fake document.
    """
    height, width = image.shape[:2]
    area_total = float(height * width)

    scale = min(1.0, 1200.0 / max(height, width))
    small = cv2.resize(
        image,
        (max(1, int(width * scale)), max(1, int(height * scale))),
        interpolation=cv2.INTER_AREA,
    )

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 60, 160)
    edges = cv2.morphologyEx(
        edges,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        iterations=2,
    )

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:12]

    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        polygon = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(polygon) != 4 or not cv2.isContourConvex(polygon):
            continue

        polygon_area = cv2.contourArea(polygon) / max(scale * scale, 1e-9)
        if polygon_area < area_total * 0.30:
            continue

        quad = polygon.reshape(4, 2).astype(np.float32) / max(scale, 1e-9)
        warped = warp_quad(image, quad)
        wh = sorted(warped.shape[:2])
        if wh[0] <= 0:
            continue

        aspect = wh[1] / float(wh[0])
        # KTP physical ratio ~= 1.586. Allow perspective/crop tolerance.
        if 1.30 <= aspect <= 1.90:
            if warped.shape[0] > warped.shape[1]:
                warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)
            return warped, True

    return image, False


def clahe_color(image: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    merged = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def clahe_gray(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced = cv2.fastNlMeansDenoising(enhanced, None, 7, 7, 21)
    return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)


def adaptive_binary(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.fastNlMeansDenoising(gray, None, 7, 7, 21)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        9,
    )
    return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)


def build_variants(image: np.ndarray) -> tuple[list[tuple[str, np.ndarray]], bool]:
    rectified, did_rectify = try_rectify_ktp(image)
    base = resize_for_ocr(rectified)

    variants: list[tuple[str, np.ndarray]] = [("base", base)]
    if MAX_VARIANTS >= 2:
        variants.append(("clahe_color", clahe_color(base)))
    if MAX_VARIANTS >= 3:
        variants.append(("clahe_gray", clahe_gray(base)))
    if MAX_VARIANTS >= 4:
        variants.append(("adaptive_binary", adaptive_binary(base)))

    return variants, did_rectify


def compute_capture_quality(image: np.ndarray) -> dict[str, Any]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape[:2]

    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    glare_ratio = float(np.mean(gray >= 248))

    flags: list[str] = []
    score = 1.0

    if min(width, height) < 600:
        flags.append("low_resolution")
        score -= 0.18
    if brightness < 55:
        flags.append("too_dark")
        score -= 0.20
    elif brightness > 215:
        flags.append("too_bright")
        score -= 0.16
    if contrast < 28:
        flags.append("low_contrast")
        score -= 0.14
    if blur_variance < 55:
        flags.append("blurry")
        score -= 0.25
    if glare_ratio > 0.12:
        flags.append("glare")
        score -= 0.15

    return {
        "score": round(max(0.0, min(1.0, score)), 4),
        "width": int(width),
        "height": int(height),
        "brightness": round(brightness, 2),
        "contrast": round(contrast, 2),
        "blur_variance": round(blur_variance, 2),
        "glare_ratio": round(glare_ratio, 4),
        "flags": flags,
    }


def json_safe(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, Mapping):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def mapping_from_result(value: Any) -> dict[str, Any]:
    candidates: list[Any] = [value]

    for attr_name in ("json", "res", "data"):
        try:
            attr = getattr(value, attr_name)
            attr = attr() if callable(attr) else attr
            candidates.append(attr)
        except Exception:
            pass

    for method_name in ("to_dict", "dict"):
        try:
            method = getattr(value, method_name)
            candidates.append(method())
        except Exception:
            pass

    for candidate in candidates:
        if candidate is None:
            continue

        if isinstance(candidate, str):
            try:
                candidate = json.loads(candidate)
            except json.JSONDecodeError:
                continue

        if isinstance(candidate, Mapping):
            data = dict(candidate)
            if isinstance(data.get("res"), Mapping):
                data = dict(data["res"])
            return json_safe(data)

        # Some PaddleX result objects support dict-like indexing but do not
        # register as Mapping.
        try:
            data = {
                "rec_texts": candidate["rec_texts"],
                "rec_scores": candidate["rec_scores"],
                "rec_polys": candidate.get("rec_polys") if hasattr(candidate, "get") else None,
                "rec_boxes": candidate.get("rec_boxes") if hasattr(candidate, "get") else None,
            }
            return json_safe(data)
        except Exception:
            continue

    return {}


def normalize_box(value: Any) -> list[list[float]] | None:
    if value is None:
        return None

    array = np.asarray(value)
    if array.size == 0:
        return None

    if array.ndim == 1 and array.size == 4:
        x1, y1, x2, y2 = [float(v) for v in array.tolist()]
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    if array.ndim >= 2 and array.shape[-1] == 2:
        points = array.reshape(-1, 2)[:4]
        return [[round(float(x), 2), round(float(y), 2)] for x, y in points]

    return None


def parse_v3_output(raw: Sequence[Any], variant: str) -> list[Segment]:
    segments: list[Segment] = []

    for page in raw:
        data = mapping_from_result(page)
        texts = data.get("rec_texts")
        scores = data.get("rec_scores")
        boxes = data.get("rec_polys") or data.get("rec_boxes")

        if not isinstance(texts, list):
            continue

        if not isinstance(scores, list):
            scores = [1.0] * len(texts)

        for index, text_value in enumerate(texts):
            text = clean_ocr_text(text_value)
            if not text:
                continue

            try:
                confidence = float(scores[index]) if index < len(scores) else 1.0
            except (TypeError, ValueError):
                confidence = 0.0

            if confidence > 1.0 and confidence <= 100.0:
                confidence /= 100.0
            confidence = max(0.0, min(1.0, confidence))

            if confidence < MIN_SEGMENT_CONFIDENCE:
                continue

            box = None
            if isinstance(boxes, list) and index < len(boxes):
                box = normalize_box(boxes[index])

            segments.append(
                Segment(
                    text=text,
                    confidence=round(confidence, 6),
                    box=box,
                    variant=variant,
                )
            )

    return order_segments(segments)


def parse_legacy_output(raw: Any, variant: str) -> list[Segment]:
    segments: list[Segment] = []
    if not isinstance(raw, list):
        return segments

    pages: list[Any] = raw
    # Common v2 output is [page_lines] for a single image.
    if pages and looks_like_legacy_line(pages[0]):
        pages = [pages]

    for page in pages:
        if not isinstance(page, list):
            continue

        for line in page:
            if not looks_like_legacy_line(line):
                continue

            try:
                text = clean_ocr_text(line[1][0])
                confidence = float(line[1][1])
                box = normalize_box(line[0])
            except (IndexError, TypeError, ValueError):
                continue

            if not text or confidence < MIN_SEGMENT_CONFIDENCE:
                continue

            segments.append(
                Segment(
                    text=text,
                    confidence=round(max(0.0, min(1.0, confidence)), 6),
                    box=box,
                    variant=variant,
                )
            )

    return order_segments(segments)


def looks_like_legacy_line(value: Any) -> bool:
    return (
        isinstance(value, (list, tuple))
        and len(value) >= 2
        and isinstance(value[1], (list, tuple))
        and len(value[1]) >= 2
    )


def clean_ocr_text(value: Any, max_length: int = 500) -> str:
    if value is None:
        return ""
    text = str(value).replace("\x00", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_length]


def order_segments(segments: list[Segment]) -> list[Segment]:
    if not any(segment.box for segment in segments):
        return segments

    def key(segment: Segment) -> tuple[float, float]:
        if not segment.box:
            return (10**9, 10**9)
        xs = [point[0] for point in segment.box]
        ys = [point[1] for point in segment.box]
        return (sum(ys) / len(ys), sum(xs) / len(xs))

    return sorted(segments, key=key)


DIGIT_CONFUSIONS = {
    "I": "1",
    "L": "1",
    "|": "1",
    "O": "0",
    "Q": "0",
    "B": "8",
    "S": "5",
    "G": "6",
    "Z": "2",
}


def normalize_digit_candidate(value: str) -> tuple[str, int]:
    output: list[str] = []
    substitutions = 0

    for character in value.upper():
        if character.isdigit():
            output.append(character)
        elif character in DIGIT_CONFUSIONS:
            output.append(DIGIT_CONFUSIONS[character])
            substitutions += 1

    return "".join(output), substitutions


def nik_date_plausible(nik: str) -> bool:
    if len(nik) != 16 or not nik.isdigit():
        return False

    try:
        day = int(nik[6:8])
        month = int(nik[8:10])
    except ValueError:
        return False

    if day > 40:
        day -= 40

    return 1 <= day <= 31 and 1 <= month <= 12


def extract_nik(segments: list[Segment]) -> tuple[str | None, str | None, bool, float]:
    candidates: list[tuple[int, int, float, str]] = []

    for segment in segments:
        upper = segment.text.upper()
        # Prefer the substring after the NIK label when available.
        source = re.split(r"\bN[\s:/.-]*I[\s:/.-]*K\b", upper, maxsplit=1)
        parts = [source[-1]] if len(source) == 2 else [upper]

        for part in parts:
            digit_like_runs = re.findall(r"[0-9IL|OQBSGZ][0-9IL|OQBSGZ\s:./-]{12,24}", part)
            if not digit_like_runs and "NIK" in upper:
                digit_like_runs = [part]

            for run in digit_like_runs:
                normalized, substitutions = normalize_digit_candidate(run)
                if len(normalized) < 14:
                    continue

                # A run can accidentally include a label-side date or other digits.
                # Consider 16-digit windows instead of blindly truncating the front.
                windows = (
                    [normalized]
                    if len(normalized) == 16
                    else [normalized[i : i + 16] for i in range(max(0, len(normalized) - 15))]
                )

                for candidate in windows:
                    if len(candidate) != 16:
                        continue
                    valid = nik_date_plausible(candidate)
                    label_bonus = 2 if re.search(r"\bN[\s:/.-]*I[\s:/.-]*K\b", upper) else 0
                    candidates.append(
                        (
                            1 if valid else 0,
                            label_bonus - substitutions,
                            segment.confidence,
                            candidate,
                        )
                    )

    if not candidates:
        return None, None, False, 0.0

    candidates.sort(reverse=True)
    valid, _, confidence, candidate = candidates[0]
    return candidate if valid else None, candidate, bool(valid), round(confidence, 6)


LABEL_PATTERNS: dict[str, list[str]] = {
    "nama": [r"\bNAMA\b"],
    "tempat_tgl_lahir": [r"TEMPAT\s*/?\s*TGL\s*LAHIR", r"TEMPAT\s*LAHIR"],
    "jenis_kelamin": [r"JENIS\s*KELAMIN"],
    "alamat": [r"\bALAMAT\b"],
    "rt_rw": [r"\bRT\s*/\s*RW\b", r"\bRTRW\b"],
    "kel_desa": [r"KEL\s*/\s*DESA", r"KELURAHAN", r"\bDESA\b"],
    "kecamatan": [r"KECAMATAN"],
    "pekerjaan": [r"PEKERJAAN"],
    "kewarganegaraan": [r"KEWARGANEGARAAN"],
    "berlaku_hingga": [r"BERLAKU\s*HINGGA"],
}

ALL_LABEL_REGEX = re.compile(
    "|".join(pattern for patterns in LABEL_PATTERNS.values() for pattern in patterns),
    re.IGNORECASE,
)


def value_after_label(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        value = text[match.end() :]
        value = re.sub(r"^[\s:;|./-]+", "", value).strip()
        return value
    return ""


def parse_ktp_fields(segments: list[Segment]) -> tuple[dict[str, str], dict[str, float], list[str]]:
    fields: dict[str, str] = {}
    confidence: dict[str, float] = {}
    warnings_out: list[str] = []

    nik, nik_candidate, nik_valid, nik_conf = extract_nik(segments)
    if nik_candidate:
        fields["nik_candidate"] = nik_candidate
        confidence["nik_candidate"] = nik_conf
    if nik:
        fields["nik"] = nik
        confidence["nik"] = nik_conf
    elif nik_candidate:
        warnings_out.append("nik_candidate_format_uncertain")

    lines = [segment.text for segment in segments]

    # Header fields.
    for index, segment in enumerate(segments[:8]):
        upper = segment.text.upper()
        if "PROVINSI" in upper:
            value = value_after_label(segment.text, [r"PROVINSI"])
            if value:
                fields.setdefault("provinsi", value)
                confidence.setdefault("provinsi", segment.confidence)
        if "KABUPATEN" in upper or re.search(r"\bKOTA\b", upper):
            value = value_after_label(segment.text, [r"KABUPATEN", r"\bKOTA\b"])
            if value:
                fields.setdefault("kabupaten_kota", value)
                confidence.setdefault("kabupaten_kota", segment.confidence)

    # Label-driven fields. Never extract religion or marital status here.
    for index, segment in enumerate(segments):
        text = segment.text
        for field_name, patterns in LABEL_PATTERNS.items():
            if field_name in fields:
                continue

            value = value_after_label(text, patterns)
            if value:
                fields[field_name] = value[:250]
                confidence[field_name] = segment.confidence
                continue

            if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns):
                if index + 1 < len(segments):
                    next_segment = segments[index + 1]
                    next_text = next_segment.text.strip()
                    if next_text and not ALL_LABEL_REGEX.search(next_text):
                        fields[field_name] = next_text[:250]
                        confidence[field_name] = next_segment.confidence

    # Address often spans more than one OCR segment.
    address = fields.get("alamat", "")
    if address:
        try:
            address_index = next(
                index
                for index, segment in enumerate(segments)
                if re.search(r"\bALAMAT\b", segment.text, re.IGNORECASE)
            )
        except StopIteration:
            address_index = -1

        if address_index >= 0:
            extras: list[str] = []
            for segment in segments[address_index + 1 : address_index + 3]:
                if ALL_LABEL_REGEX.search(segment.text):
                    break
                if segment.text.strip() and segment.text.strip() != address:
                    extras.append(segment.text.strip())
            if extras:
                fields["alamat"] = " ".join([address, *extras])[:350]

    return fields, confidence, warnings_out


def aggregate_raw_text(segments: list[Segment]) -> str:
    return "\n".join(segment.text for segment in segments if segment.text.strip())[:12000]


def evaluate_segments(name: str, segments: list[Segment]) -> VariantResult:
    mean_confidence = (
        float(sum(segment.confidence for segment in segments) / len(segments))
        if segments
        else 0.0
    )
    nik, nik_candidate, nik_valid, _ = extract_nik(segments)

    marker_count = 0
    combined = " ".join(segment.text.upper() for segment in segments)
    for marker in ("NIK", "NAMA", "ALAMAT", "KECAMATAN", "PROVINSI", "KABUPATEN", "KOTA"):
        if marker in combined:
            marker_count += 1

    score = (
        mean_confidence * 0.55
        + min(len(segments), 16) / 16.0 * 0.18
        + min(marker_count, 5) / 5.0 * 0.12
        + (0.15 if nik_valid else 0.0)
    )

    return VariantResult(
        name=name,
        segments=segments,
        mean_confidence=round(mean_confidence, 6),
        score=round(score, 6),
        nik_candidate=nik or nik_candidate,
        nik_valid=nik_valid,
    )


def should_stop_early(result: VariantResult) -> bool:
    return (
        result.nik_valid
        and result.mean_confidence >= STRONG_MEAN_CONFIDENCE
        and len(result.segments) >= 7
    )


def process_document(image: np.ndarray) -> dict[str, Any]:
    started = time.perf_counter()
    capture_quality = compute_capture_quality(image)
    variants, rectified = build_variants(image)

    results: list[VariantResult] = []
    for name, variant_image in variants:
        segments = runtime.infer(variant_image, name)
        evaluated = evaluate_segments(name, segments)
        results.append(evaluated)

        logger.info(
            "variant=%s segments=%s mean_conf=%.3f score=%.3f nik_valid=%s",
            name,
            len(segments),
            evaluated.mean_confidence,
            evaluated.score,
            evaluated.nik_valid,
        )

        if should_stop_early(evaluated):
            break

    best = max(results, key=lambda item: item.score, default=VariantResult("base", [], 0.0, 0.0, None, False))
    fields, field_confidence, parse_warnings = parse_ktp_fields(best.segments)

    nik = fields.get("nik")
    nik_candidate = fields.get("nik_candidate")

    warnings_out = list(parse_warnings)
    if not best.segments:
        warnings_out.append("no_text_detected")
    if capture_quality["flags"]:
        warnings_out.extend(f"capture_{flag}" for flag in capture_quality["flags"])
    if best.mean_confidence < 0.55 and best.segments:
        warnings_out.append("low_ocr_confidence")

    # Deduplicate without losing order.
    warnings_out = list(dict.fromkeys(warnings_out))

    raw_text = aggregate_raw_text(best.segments)

    return {
        "status": "success",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "document_type": "ktp",
        # Compatibility contract currently consumed by ai_service.
        "nik": nik,
        "nik_candidate": nik_candidate,
        "raw_text_for_vllm": raw_text,
        "all_segments": [segment.public() for segment in best.segments],
        # Richer deterministic output for future callers.
        "fields": fields,
        "field_confidence": field_confidence,
        "capture_quality": capture_quality,
        "ocr": {
            "engine": "paddleocr",
            "engine_api": runtime.api,
            "lang": OCR_LANG,
            "ocr_version": OCR_VERSION,
            "device": OCR_DEVICE,
            "selected_variant": best.name,
            "rectified": rectified,
            "segment_count": len(best.segments),
            "mean_confidence": best.mean_confidence,
            "variant_score": best.score,
            "variants_attempted": [
                {
                    "name": item.name,
                    "segments": len(item.segments),
                    "mean_confidence": item.mean_confidence,
                    "score": item.score,
                    "nik_valid": item.nik_valid,
                }
                for item in results
            ],
        },
        "warnings": warnings_out,
        "latency_ms": round((time.perf_counter() - started) * 1000),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> JSONResponse:
    started = time.perf_counter()

    if not runtime.ready:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "OCR_ENGINE_NOT_READY",
                "message": runtime.error or f"OCR engine state: {runtime.state}",
            },
        )

    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail={
                "error": "UNSUPPORTED_IMAGE_TYPE",
                "message": f"Unsupported content type: {content_type}",
            },
        )

    contents = await read_upload_limited(file)
    await file.close()

    try:
        image = await run_in_threadpool(decode_image, contents)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_IMAGE", "message": str(exc)},
        ) from exc

    acquired = False
    try:
        try:
            await asyncio.wait_for(inference_semaphore.acquire(), timeout=QUEUE_TIMEOUT_SEC)
            acquired = True
        except asyncio.TimeoutError as exc:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "OCR_BUSY",
                    "message": "OCR service is busy. Retry shortly.",
                },
            ) from exc

        result = await run_in_threadpool(process_document, image)
        result["request_latency_ms"] = round((time.perf_counter() - started) * 1000)
        return JSONResponse(result)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("OCR inference failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "OCR_INFERENCE_FAILED",
                "message": "OCR inference failed.",
            },
        ) from exc
    finally:
        if acquired:
            inference_semaphore.release()
