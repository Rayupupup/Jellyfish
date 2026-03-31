"""FastAPI 依赖注入。"""

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException
from langchain_core.language_models.chat_models import BaseChatModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import async_session_maker
from app.models.llm import ModelCategoryKey
from app.services.llm.resolver import get_default_model_by_category, get_provider_by_model_or_id


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """提供异步数据库会话。"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_llm(db: AsyncSession = Depends(get_db)) -> BaseChatModel:
    """提供默认文本 LLM（ChatOpenAI），从数据库读取默认文本模型；未配置则抛出 503。"""
    model = await get_default_model_by_category(db, ModelCategoryKey.text)
    provider = await get_provider_by_model_or_id(db, model)

    api_key = (provider.api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Provider api_key is empty for provider_id={provider.id}",
        )
    try:
        from langchain_openai import ChatOpenAI
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="Install langchain-openai (e.g. uv sync --group dev) to use film extraction endpoints",
        ) from e

    kwargs: dict = dict(model.params or {})
    kwargs["model"] = model.name
    kwargs["api_key"] = api_key
    kwargs.setdefault("temperature", 0)
    base_url = (provider.base_url or "").strip()
    if base_url:
        kwargs.setdefault("base_url", base_url)
    return ChatOpenAI(**kwargs)

async def get_nothinking_llm(db: AsyncSession = Depends(get_db)) -> BaseChatModel:
    """提供默认文本 LLM（ChatOpenAI，禁用 thinking），从数据库读取默认文本模型；未配置则抛出 503。"""
    model = await get_default_model_by_category(db, ModelCategoryKey.text)
    provider = await get_provider_by_model_or_id(db, model)

    api_key = (provider.api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=f"Provider api_key is empty for provider_id={provider.id}",
        )
    try:
        from langchain_openai import ChatOpenAI
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="Install langchain-openai (e.g. uv sync --group dev) to use film extraction endpoints",
        ) from e

    kwargs: dict = dict(model.params or {})
    kwargs["model"] = model.name
    kwargs["api_key"] = api_key
    kwargs.setdefault("temperature", 0)
    base_url = (provider.base_url or "").strip()
    if base_url:
        kwargs.setdefault("base_url", base_url)

    extra_body = dict(kwargs.get("extra_body") or {})
    extra_body["enable_thinking"] = False
    kwargs["extra_body"] = extra_body
    return ChatOpenAI(**kwargs)


class _ImageHttpRunnable:
    """最小图片生成 runnable：从环境变量读取配置，通过 HTTP 调用外部图片生成服务。"""

    def __init__(self, *, base_url: str, api_key: str, timeout_s: float = 60.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout_s = timeout_s

    def invoke(self, payload: dict) -> dict:  # noqa: ANN001
        try:
            import httpx
        except ImportError as e:  # pragma: no cover
            raise HTTPException(status_code=503, detail="Install httpx to enable image generation") from e
        with httpx.Client(timeout=self._timeout_s) as client:
            r = client.post(
                self._base_url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, dict) else {"images": data}

    async def ainvoke(self, payload: dict) -> dict:  # noqa: ANN001
        try:
            import httpx
        except ImportError as e:  # pragma: no cover
            raise HTTPException(status_code=503, detail="Install httpx to enable image generation") from e
        async with httpx.AsyncClient(timeout=self._timeout_s) as client:
            r = await client.post(
                self._base_url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
            return data if isinstance(data, dict) else {"images": data}
