FROM ghcr.io/astral-sh/uv:0.7-bookworm-slim@sha256:61d00f5b99850984608b478a337c8f0d5b4b8c0bf69f54d65f2b0fa3f325f2a2 AS builder

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
ENV UV_PYTHON_INSTALL_DIR=/python
ENV UV_PYTHON_PREFERENCE=only-managed

RUN uv python install 3.12

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY . .

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=python:python /python /python
COPY --from=builder --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH"
CMD ["fastapi", "run", "--host", "0.0.0.0", "/app/main.py"]
