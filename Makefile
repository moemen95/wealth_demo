.DEFAULT_GOAL := help
SHELL := /bin/bash

BACKEND := backend
FRONTEND := frontend

# Load backend/.env into every recipe's environment. The backend no longer loads
# .env itself (python-dotenv removed) — `make` is the single source of truth, so
# the variables are exported here before uvicorn (or any target) runs. Guarded so
# `make env` still works before the file exists. Keep backend/.env simple
# KEY=value lines (no `$` — make would expand it).
ifneq (,$(wildcard $(BACKEND)/.env))
-include $(BACKEND)/.env
export
endif

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Install backend (uv) and frontend (pnpm) dependencies
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && pnpm install

.PHONY: env
env: ## Create backend/.env and frontend/.env from the examples if missing
	@test -f $(BACKEND)/.env || (cp $(BACKEND)/.env.example $(BACKEND)/.env && \
	  echo "Created $(BACKEND)/.env — edit it to set LLM_PROVIDER + credentials.")
	@test -f $(FRONTEND)/.env || (cp $(FRONTEND)/.env.example $(FRONTEND)/.env && \
	  echo "Created $(FRONTEND)/.env — edit it to set NEXT_PUBLIC_API_BASE.")

.PHONY: backend
backend: env ## Run the FastAPI backend on :8000 (env vars loaded from backend/.env)
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000

.PHONY: frontend
frontend: env ## Run the Next.js frontend on :3000
	cd $(FRONTEND) && pnpm dev

.PHONY: dev
dev: env ## Run backend + frontend together (one command)
	@echo "Starting backend (:8000) and frontend (:3000)…  Ctrl-C to stop both."
	@trap 'kill 0' EXIT INT TERM; \
	 ( cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000 ) & \
	 ( cd $(FRONTEND) && pnpm dev ) & \
	 wait

.PHONY: test
test: env ## Run backend tests
	cd $(BACKEND) && uv run pytest -q

.PHONY: up
up: ## Run both services via Docker Compose
	docker compose --env-file $(BACKEND)/.env up --build

.PHONY: down
down: ## Stop Docker Compose services
	docker compose down

.PHONY: clean
clean: ## Remove build artifacts and virtualenvs
	rm -rf $(BACKEND)/.venv $(FRONTEND)/.next $(FRONTEND)/node_modules
