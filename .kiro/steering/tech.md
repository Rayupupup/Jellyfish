# Tech Stack

## Backend

- **Runtime**: Python 3.12
- **Framework**: FastAPI (async)
- **ORM**: SQLAlchemy (async) with `aiosqlite` (default) — swappable to PostgreSQL/MySQL
- **AI/LLM**: LangChain + LangGraph for agent workflows and prompt management
- **Config**: `pydantic-settings` loading from `.env`
- **Package Manager**: `uv`
- **External integrations**: OpenAI-compatible LLMs, image generation APIs, video generation APIs (e.g. Doubao Seedance), S3-compatible object storage, Volcano Engine TTS

## Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Library**: Ant Design 5
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios (with interceptors in `front/src/services/http.ts`)
- **i18n**: i18next (zh-CN / en-US)
- **Package Manager**: pnpm
- **API Types**: Auto-generated from backend OpenAPI spec via `openapi-typescript-codegen` → `front/src/services/generated/`

## Common Commands

### Backend

```bash
cd backend
uv sync                                          # install/sync dependencies
uv add <pkg>                                     # add a dependency
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000   # dev server
uv run pytest                                    # run tests
uv run python init_db.py                         # initialize DB tables
```

### Frontend

```bash
cd front
pnpm install                  # install dependencies
pnpm dev                      # dev server on :7788
pnpm build                    # tsc + vite build → dist/
pnpm typecheck                # type check only
pnpm lint                     # ESLint
pnpm lint:fix                 # ESLint with auto-fix
pnpm openapi:update           # fetch openapi.json from :8000 and regenerate types
```

## API

- Base path: `/api/v1`
- Docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`
- All responses use the unified `ApiResponse<T>` envelope: `{ code, message, data }`
- Paginated responses wrap data in `PaginatedData<T>`: `{ items, pagination }`
