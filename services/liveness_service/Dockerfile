FROM python:3.11-slim

WORKDIR /app

ARG PIP_INDEX_URL=https://pypi.org/simple

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
    && pip install --no-cache-dir fastapi uvicorn python-multipart numpy \
    && pip install --no-cache-dir --default-timeout=1000 \
    --index-url ${PIP_INDEX_URL} \
    -r requirements.txt

# 4. Copy source code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
