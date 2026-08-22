FROM python:3.11-slim-bookworm

WORKDIR /app

ARG PIP_INDEX_URL=https://pypi.org/simple

# The pinned Silent-Face ONNX models consume float32 BGR tensors in the
# original 0..255 range. Keep this explicit so a fresh container cannot fall
# back to the generic normalized-input default in liveness_model.py.
ENV LIVENESS_INPUT_SCALE=1.0

# 1. Install dependensi sistem
RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy requirements dulu agar layer dependency bisa di-cache
COPY requirements.txt .

# 3. Install dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --default-timeout=1000 \
    --index-url ${PIP_INDEX_URL} \
    -r requirements.txt

# 4. Copy source code
COPY . .

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
