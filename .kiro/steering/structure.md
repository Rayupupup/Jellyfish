# Project Structure

```
jellyfish/
├── backend/                        # Python FastAPI backend
│   ├── pyproject.toml              # uv dependencies
│   ├── .env / .env.example         # environment config
│   └── app/
│       ├── main.py                 # FastAPI app entry, middleware, exception handlers
│       ├── config.py               # Settings via pydantic-settings
│       ├── dependencies.py         # FastAPI DI: get_db, get_llm, get_image_runnable
│       ├── api/v1/
│       │   ├── __init__.py         # aggregates all routers
│       │   └── routes/
│       │       ├── studio/         # core studio CRUD routes (shots, chapters, projects, assets, etc.)
│       │       ├── film/           # film skill routes (entity/shotlist extraction)
│       │       ├── llm.py          # LLM model management routes
│       │       └── script_processing.py
│       ├── models/                 # SQLAlchemy ORM models
│       │   ├── base.py             # Base, common id/timestamp mixins
│       │   ├── studio.py           # core studio models (Project, Chapter, Shot, Actor, Scene, etc.)
│       │   ├── studio_assets.py    # asset models
│       │   ├── studio_shots.py     # shot detail, dialog, frame image models
│       │   └── ...
│       ├── schemas/                # Pydantic request/response schemas
│       │   ├── common.py           # ApiResponse, PaginatedData, helpers
│       │   ├── studio/             # studio-specific schemas
│       │   └── skills/             # skill-specific schemas
│       ├── services/               # business logic layer
│       │   ├── studio/             # studio service helpers
│       │   ├── llm/                # LLM service helpers
│       │   ├── tts_service.py
│       │   ├── video_generation_service.py
│       │   └── audio_mix_service.py
│       ├── chains/                 # LangChain/LangGraph
│       │   ├── prompts.py          # PromptTemplate definitions
│       │   ├── graphs.py           # LangGraph StateGraph definitions
│       │   └── agents/             # agent node implementations
│       ├── core/
│       │   ├── db.py               # async engine, session maker, init_db
│       │   ├── storage.py          # S3/object storage abstraction
│       │   └── task_manager/       # async task queue (manager, stores, strategies)
│       └── utils/                  # shared utilities (file helpers, project link upsert)
│
└── front/                          # React + TypeScript frontend
    ├── package.json                # pnpm dependencies
    ├── vite.config.ts              # Vite config, dev port :7788
    ├── tailwind.config.js
    ├── openapi.json                # cached backend OpenAPI spec
    └── src/
        ├── main.tsx                # app entry
        ├── App.tsx                 # router setup
        ├── i18n.ts                 # i18next init
        ├── pages/                  # page-level components (aiStudio/, Settings, NotFound)
        ├── components/             # shared UI components
        ├── layouts/                # layout wrappers (MainLayout)
        ├── store/                  # Zustand stores (useAppStore)
        ├── services/
        │   ├── http.ts             # Axios instance with interceptors
        │   ├── openapi.ts          # OpenAPI client init
        │   ├── generated/          # AUTO-GENERATED — do not edit manually
        │   └── *.ts                # hand-written service modules
        ├── locales/                # i18n translation files (zh-CN, en-US)
        └── mocks/                  # MSW mock handlers for development
```

## Key Conventions

### Backend
- All API responses use `ApiResponse[T]` from `app/schemas/common.py` — always return via `success_response()` or `paginated_response()`
- Route files define multiple `APIRouter` instances per file when grouping sub-resources (e.g. `router`, `details_router`, `dialog_router`)
- DB session is injected via `Depends(get_db)`; always `await db.flush()` + `await db.refresh(obj)` after mutations, never call `db.commit()` directly in routes (handled by `get_db`)
- Validate foreign key existence with `_ensure_*` helper functions before creating/updating records
- Update patterns use `body.model_dump(exclude_unset=True)` + `setattr` loop
- Delete endpoints return `success_response(None)` even when the object doesn't exist (idempotent)
- ORM models live in `app/models/`, Pydantic schemas in `app/schemas/`, business logic in `app/services/`

### Frontend
- `front/src/services/generated/` is auto-generated — never edit manually; regenerate with `pnpm openapi:update`
- Global state goes in Zustand stores under `src/store/`
- HTTP calls go through `src/services/http.ts` (Axios instance); response interceptor unwraps `response.data`
- UI language defaults to zh-CN; translations in `src/locales/`
