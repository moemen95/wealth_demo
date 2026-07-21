# Backend — Wealth Insights Demo

FastAPI service exposing three architectures (raw / skills / agentic) over a
provider abstraction that runs on **OpenAI** or **Gemini on Vertex AI**.

See the root [`README.md`](../README.md) and [`SPEC.md`](../SPEC.md) for the full picture.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
