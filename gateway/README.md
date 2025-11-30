## Setup and Running

This project uses [uv](https://docs.astral.sh/uv/) for dependency management.

### To run outside Docker:

```bash
# Install dependencies (like pip install)
uv sync         
# Run the application
uv run python main.py
# Add a dependency
uv add httpx
# Add a dev-only dependency
uv add --dev httpx
```

The project will start at `http://localhost:8000`
A virtual environment is created automatically - you do not need to activate it first.
