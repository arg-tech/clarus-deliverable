## Setup and Running

This project uses [uv](https://docs.astral.sh/uv/) for dependency management.

### To run outside Docker:

```bash
# Install dependencies (like pip install)
uv sync         
# Run the application (no need to activate virtual environment)
uv run python -m uvicorn main:app --host 0.0.0.0 --app-dir /app
# Run the tests
uv run pytest

# Add a dependency
uv add httpx
# Add a dev-only dependency
uv add --dev httpx
```

### To remote debug from IDE with breakpoints
Ensure this folder is opened as the top-level folder in a VS Code compatible editor, and use the Run and Debug menu to start the container and attach the debugger.
