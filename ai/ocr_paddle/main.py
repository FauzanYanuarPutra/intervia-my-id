from fastapi import FastAPI, File, UploadFile, HTTPException
import numpy as np
import cv2
import re

PaddleOCR = None
OCR_BOOT_ERROR = None
try:
    from paddleocr import PaddleOCR as _PaddleOCR

    PaddleOCR = _PaddleOCR
except Exception as err:
    OCR_BOOT_ERROR = f"PaddleOCR import gagal: {err}"

app = FastAPI()

def build_ocr():
    """
    PaddleOCR API berubah antar versi.
    Coba konfigurasi dari yang paling baru ke legacy.
    """
    if PaddleOCR is None:
        return None, OCR_BOOT_ERROR or "PaddleOCR tidak tersedia"

    candidates = [
        {"lang": "id"},
        {"use_angle_cls": True, "lang": "id"},
        {"use_angle_cls": True, "lang": "id", "use_gpu": False},
    ]
    last_error = None
    for kwargs in candidates:
        try:
            return PaddleOCR(**kwargs), None
        except Exception as err:
            last_error = err
    return None, f"Gagal inisialisasi PaddleOCR: {last_error}"


ocr, ocr_boot_error = build_ocr()

def maximize_image_quality(img):
    """
    Teknik Preprocessing untuk menghilangkan noise background KTP
    """
    # 1. Resize jika terlalu kecil agar OCR lebih akurat
    height, width = img.shape[:2]
    if width < 1000:
        img = cv2.resize(img, (None, None), fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # 2. Ubah ke Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # Ini mempertajam teks tanpa merusak gambar
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)

    # 4. Denoising untuk menghilangkan bintik-bintik background biru KTP
    denoised = cv2.fastNlMeansDenoising(enhanced, None, 10, 7, 21)

    # 5. Adaptive Thresholding (Membuat gambar jadi hitam putih total / Binary)
    # Sangat membantu jika pencahayaan saat foto KTP tidak rata
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                  cv2.THRESH_BINARY, 11, 2)
    
    return thresh

def strict_clean_nik(text):
    """Membersihkan NIK dari karakter yang sering salah baca (misal 'I' jadi '1')"""
    lookup = {'I': '1', 'L': '1', 'O': '0', 'B': '8', 'S': '5', 'G': '6'}
    text = text.upper()
    for k, v in lookup.items():
        text = text.replace(k, v)
    return re.sub(r'[^0-9]', '', text)

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if ocr is None:
        raise HTTPException(
            status_code=503,
            detail=ocr_boot_error or "OCR engine belum siap",
        )

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        original_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if original_img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        # --- PROSES MAXIMIZE ---
        processed_img = maximize_image_quality(original_img)
        
        # Jalankan OCR pada gambar yang sudah di-clean
        try:
            result = ocr.ocr(processed_img, cls=True)
        except TypeError:
            result = ocr.ocr(processed_img)
        
        raw_lines = []
        full_output = []
        
        if result[0]:
            for line in result[0]:
                text = line[1][0].strip()
                conf = line[1][1]
                
                if conf > 0.45: # Threshold confidence
                    full_output.append({"text": text, "confidence": float(conf)})
                    raw_lines.append(text.upper())

        # Gabungkan teks untuk vLLM
        combined_text = " ".join(raw_lines)

        # Logic Ekstraksi NIK yang lebih cerdas
        nik = None
        for line in raw_lines:
            # Cari baris yang punya banyak angka
            cleaned = strict_clean_nik(line)
            if len(cleaned) == 16:
                nik = cleaned
                break
            elif 14 <= len(cleaned) <= 17: # Toleransi jika OCR sedikit meleset
                nik = cleaned[:16]

        return {
            "status": "success",
            "nik": nik,
            "raw_text_for_vllm": combined_text,
            "all_segments": full_output
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health")
async def health():
    if ocr is None:
        return {"status": "degraded", "reason": ocr_boot_error}
    return {"status": "ready"}
