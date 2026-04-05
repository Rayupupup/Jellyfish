"""
角色一致性服务

核心逻辑：
1. 为每个角色生成固定 seed（基于角色名 hash）
2. 生成角色参考图并保存到 CharacterImage
3. 视频生成时，获取镜头关联角色的参考图作为 first_frame 的补充
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.studio import (
    Character,
    CharacterImage,
    FileItem,
    FileType,
    Shot,
    ShotCharacterLink,
)
from app.core import storage

logger = logging.getLogger(__name__)


def generate_character_seed(character_name: str) -> int:
    """根据角色名生成固定 seed（0-999999）"""
    hash_val = int(hashlib.md5(character_name.encode()).hexdigest(), 16)
    return hash_val % 1000000


async def get_character_reference_image_url(
    db: AsyncSession,
    character_id: str,
) -> Optional[str]:
    """获取角色的主参考图 URL"""
    stmt = (
        select(CharacterImage)
        .where(CharacterImage.character_id == character_id)
        .order_by(CharacterImage.id.asc())
        .limit(1)
    )
    img = (await db.execute(stmt)).scalars().first()
    if img is None or img.file_id is None:
        return None

    file_item = await db.get(FileItem, img.file_id)
    if file_item is None:
        return None

    try:
        url = await storage.get_url(file_item.storage_key)
        return url
    except Exception:
        return None


async def get_shot_character_reference_images(
    db: AsyncSession,
    shot_id: str,
) -> list[str]:
    """获取镜头关联的所有角色参考图 URL 列表"""
    stmt = (
        select(ShotCharacterLink)
        .where(ShotCharacterLink.shot_id == shot_id)
    )
    links = (await db.execute(stmt)).scalars().all()

    urls = []
    for link in links:
        url = await get_character_reference_image_url(db, link.character_id)
        if url:
            urls.append(url)

    return urls


async def get_primary_character_reference_base64(
    db: AsyncSession,
    shot_id: str,
) -> Optional[str]:
    """
    获取镜头主角色的参考图 base64
    用于视频生成时作为角色一致性参考
    """
    import httpx
    import base64

    urls = await get_shot_character_reference_images(db, shot_id)
    if not urls:
        return None

    # 取第一个角色的参考图
    url = urls[0]
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                b64 = base64.b64encode(resp.content).decode()
                content_type = resp.headers.get("content-type", "image/png")
                return f"data:{content_type};base64,{b64}"
    except Exception as e:
        logger.warning(f"获取角色参考图失败: {e}")

    return None


async def ensure_character_seed(
    db: AsyncSession,
    character: Character,
) -> int:
    """确保角色有固定 seed，没有则生成并保存"""
    if character.seed is not None:
        return character.seed

    seed = generate_character_seed(character.name)
    character.seed = seed
    await db.flush()
    logger.info(f"角色 {character.name} 生成 seed: {seed}")
    return seed


async def build_character_appearance_prompt(character: Character) -> str:
    """构建角色外观描述 prompt，用于生成参考图"""
    parts = [
        f"A portrait of {character.name}",
        character.description or "",
        "front view, clear face, neutral expression",
        "high quality, detailed, white background",
        "character reference sheet, consistent appearance",
    ]
    return ", ".join(p for p in parts if p.strip())
