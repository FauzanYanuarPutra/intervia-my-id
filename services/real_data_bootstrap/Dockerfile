FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client ca-certificates curl dnsutils && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
COPY scripts/import_real_marketplace_open_data.py /workspace/scripts/import_real_marketplace_open_data.py
COPY config/real_marketplace_open_data.sources.json /workspace/config/real_marketplace_open_data.sources.json
COPY scripts/run_real_data_bootstrap.sh /workspace/scripts/run_real_data_bootstrap.sh
RUN chmod +x /workspace/scripts/run_real_data_bootstrap.sh \
    && sh -n /workspace/scripts/run_real_data_bootstrap.sh \
    && python -m py_compile /workspace/scripts/import_real_marketplace_open_data.py

ENTRYPOINT ["/workspace/scripts/run_real_data_bootstrap.sh"]