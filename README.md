# Documentation
## Pages in this documentation
- Quick Start, Evaluation, & Development (current page)
- [Architecture & Self-Hosting](docs/architecture.md)
- [Services Reference](docs/services.md)
- [API Reference](docs/api.md)


Multilingual text analysis platform for detecting bias indicators in written content. Combines rule-based lexicon matching, ML models, and LLM integration.

**Supported languages:** English, Portuguese, Czech, Finnish, Greek

## Quick Start

1. Copy `.secrets.sample` to `.secrets` and set your API keys:
   - `LLM_API_KEY.txt` - API key for local self-hosted LLM
   - `GEMINI_API_KEY.txt` - API key for Google Gemini (optional)

2. Build and run all services:
   ```bash
   docker compose up -d --build
   ```

3. Open http://localhost:7020 in your browser.

## Selective Startup

To save resources or focus on specific features, you can start only the services you need. For example, to run just the web interface and rule-based detection:

```bash
docker compose up -d web gateway rule-based-service
```

## Development

For development with hot reload and debugging:

```bash
docker compose -f compose.yml -f compose.dev.yml up -d
```

This enables hot reload for the frontend and debugpy on port 5678 for backend services.

## Running Evaluations

The `evaluation/` folder contains scripts for measuring service accuracy. These run outside Docker using UV:

```bash
cd evaluation
uv sync
uv run python evaluate_rule_based.py
uv run python evaluate_llm.py
```

See `evaluation/README.md` for detailed instructions.
