FROM python:3.12-slim-bookworm AS builder
ENV UV_LINK_MODE=copy

COPY --from=docker.io/astral/uv:0.9 /uv /uvx /bin/

WORKDIR /app

# Install outside the app folder to not conflict with code mounts
ENV UV_PROJECT_ENVIRONMENT=/usr/local/

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

COPY . .

CMD ["fastapi", "run", "--host", "0.0.0.0", "/app/main.py"]
