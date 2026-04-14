import cv2
import numpy as np


class LivenessPredictor:
    """Lightweight fallback predictor to keep liveness service operational."""

    def __init__(self, model_path: str | None = None):
        self.model_path = model_path

    def predict(self, frame: np.ndarray) -> tuple[int, float]:
        if frame is None or frame.size == 0:
            return 0, 0.0

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Empirical threshold: blurry/spoof captures tend to have lower variance.
        if sharpness >= 80.0:
            score = min(0.99, 0.75 + (sharpness / 1000.0))
            return 1, score

        score = max(0.01, sharpness / 200.0)
        return 0, score
