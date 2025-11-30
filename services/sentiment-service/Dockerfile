FROM ghcr.io/astral-sh/uv:0.7-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
ENV UV_PYTHON_INSTALL_DIR=/python
ENV UV_PYTHON_PREFERENCE=only-managed

RUN uv python install 3.12

WORKDIR /app

RUN uv venv .venv
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -r requirements.txt

COPY . .

FROM debian:bookworm-slim

COPY --from=builder --chown=python:python /python /python
COPY --from=builder --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH"
CMD ["fastapi", "run", "--host", "0.0.0.0", "/app/main.py"]
