# Tangerine Wealth — Future Outlook demo
#
# Every target sources the root .env first (ENV_FILE=… to use another file), so
# LLM_MODE / OPENAI_* / GOOGLE_* / BACKEND_PORT / FRONTEND_PORT / CORS_ORIGINS
# apply to both the backend and the frontend. Shell variables still win:
#   LLM_MODE=gemini make dev
#
SHELL := /bin/bash
.DEFAULT_GOAL := help
ENV_FILE ?= .env

# `set -a` exports everything the file defines; quoting/comments work like a shell script.
# Relative names get a ./ prefix so `.` never searches PATH; absolute paths are used as-is.
LOAD_ENV = set -a; f="$(ENV_FILE)"; case "$$f" in /*) ;; *) f="./$$f";; esac; [ -f "$$f" ] && . "$$f"; set +a;

BACKEND_PORT_DEFAULT  = 8787
FRONTEND_PORT_DEFAULT = 5173

.PHONY: help install env frontend backend dev test build preview calibrate typecheck clean

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## npm install
	@npm install

env: ## Create .env from .env.example if it does not exist
	@[ -f .env ] && echo ".env already exists" || { cp .env.example .env && echo "created .env from .env.example — edit it"; }

frontend: ## Vite dev server only (mounts /api in-process unless BACKEND_URL is set)
	@$(LOAD_ENV) npm run frontend

backend: ## Standalone API backend (LLM proxy) on BACKEND_PORT
	@$(LOAD_ENV) npm run backend

dev: ## Backend + frontend together; frontend proxies /api to the backend
	@$(LOAD_ENV) \
	  BACKEND_PORT="$${BACKEND_PORT:-$(BACKEND_PORT_DEFAULT)}"; \
	  CORS_ORIGINS="$${CORS_ORIGINS:-http://localhost:$${FRONTEND_PORT:-$(FRONTEND_PORT_DEFAULT)}}" \
	  BACKEND_PORT="$$BACKEND_PORT" npm run backend & back=$$!; \
	  BACKEND_URL="$${BACKEND_URL:-http://localhost:$$BACKEND_PORT}" npm run frontend & front=$$!; \
	  trap 'kill $$back $$front 2>/dev/null' INT TERM EXIT; \
	  wait

test: ## Unit tests (engine + summary grounding)
	@$(LOAD_ENV) npm test

typecheck: ## tsc --noEmit
	@npx tsc --noEmit

build: ## Type-check + production build of the frontend (dist/)
	@$(LOAD_ENV) npm run build

preview: ## Serve the built frontend (vite preview) + backend, /api proxied to the backend
	@$(LOAD_ENV) \
	  BACKEND_PORT="$${BACKEND_PORT:-$(BACKEND_PORT_DEFAULT)}"; \
	  CORS_ORIGINS="$${CORS_ORIGINS:-http://localhost:$${PREVIEW_PORT:-4173}}" \
	  BACKEND_PORT="$$BACKEND_PORT" npm run backend & back=$$!; \
	  BACKEND_URL="$${BACKEND_URL:-http://localhost:$$BACKEND_PORT}" npm run preview & front=$$!; \
	  trap 'kill $$back $$front 2>/dev/null' INT TERM EXIT; \
	  wait

calibrate: ## Print which badge each of the 30 segments lands on
	@$(LOAD_ENV) npm run calibrate

clean: ## Remove build output and node_modules
	@rm -rf dist node_modules
