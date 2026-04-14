from fastapi import FastAPI, File, UploadFile, HTTPException
import cv2
import numpy as np
from liveness_model import LivenessPredictor

app = FastAPI()

predictor = LivenessPredictor(model_path="./resources/anti_spoof_models")

# OpenCV fallback face detector to avoid mediapipe API drift.
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def get_face_bbox(image: np.ndarray):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(64, 64),
    )
    if len(faces) == 0:
        return None
    x, y, w, h = faces[0]
    height, width = image.shape[:2]
    return x / width, y / height, w / width, h / height


@app.post("/check")
async def check_liveness(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="File bukan gambar valid")

        h, w, _ = frame.shape
        bbox = get_face_bbox(frame)
        if not bbox:
            return {
                "is_real": False,
                "error_code": "NO_FACE_DETECTED",
                "message": "Wajah tidak terdeteksi. Pastikan pencahayaan cukup.",
            }

        _, _, bw, bh = bbox
        face_area_ratio = bw * bh
        if face_area_ratio < 0.05:
            return {
                "is_real": False,
                "error_code": "FACE_TOO_SMALL",
                "message": "Wajah terlalu jauh. Dekatkan wajah ke kamera.",
            }

        label, score = predictor.predict(frame)
        threshold = 0.90
        is_real = bool(label == 1 and score >= threshold)

        return {
            "is_real": is_real,
            "liveness_score": round(float(score), 4),
            "verdict": "REAL" if is_real else "SPOOF/FAKE",
            "metadata": {
                "face_detected": True,
                "face_coverage": round(face_area_ratio, 4),
                "threshold_used": threshold,
                "resolution": f"{w}x{h}",
            },
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/health")
def health():
    return {"status": "ready", "model": "fallback-liveness"}
