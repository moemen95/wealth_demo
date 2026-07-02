.DEFAULT_GOAL := help
SHELL := /bin/bash

BACKEND := backend
FRONTEND := frontend

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Install backend (uv) and frontend (pnpm) dependencies
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && pnpm install

.PHONY: env
env: ## Create backend/.env from the example if missing
	@test -f $(BACKEND)/.env || (cp $(BACKEND)/.env.example $(BACKEND)/.env && \
	  echo "Created $(BACKEND)/.env — edit it to set LLM_PROVIDER + credentials.")

.PHONY: backend
backend: ## Run the FastAPI backend on :8000
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000

.PHONY: frontend
frontend: ## Run the Next.js frontend on :3000
	cd $(FRONTEND) && pnpm dev

.PHONY: dev
dev: env ## Run backend + frontend together (one command)
	@echo "Starting backend (:8000) and frontend (:3000)…  Ctrl-C to stop both."
	@trap 'kill 0' EXIT INT TERM; \
	 ( cd $(BACKEND) && uv run uvicorn app.main:app --reload --port 8000 ) & \
	 ( cd $(FRONTEND) && pnpm dev ) & \
	 wait

.PHONY: test
test: ## Run backend tests
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
