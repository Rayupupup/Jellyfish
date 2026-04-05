"""视频生成任务路由"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db
from app.models.studio import Shot, ShotDetail, ShotFrameImage, FileItem
from app.schemas.common import ApiResponse, success_response
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class VideoGenerationRequest(BaseModel):
    prompt: str = ""
    duration: int = 5


async def _get_frame_url(db: AsyncSession, shot_id: str, frame_type: str) -> str | None:
    """获取分镜帧的公开 URL"""
    stmt = select(ShotFrameImage).where(
        ShotFrameImage.shot_detail_id == shot_id,
        ShotFrameImage.frame_type == frame_type,
    ).limit(1)
    frame = (await db.execute(stmt)).scalars().first()
    if not frame or not frame.file_id:
        return None
    file_obj = await db.get(FileItem, frame.file_id)
    if not file_obj:
        return None
    base = (settings.s3_public_base_url or "").rstrip("/")
    return f"{base}/{file_obj.storage_key}" if base else None


async def _poll_and_save(shot_id: str, task_id: str) -> None:
    """后台轮询视频任务，完成后写入数据库"""
    import httpx
    from app.dependencies import get_db
    from app.models.studio import Shot, FileItem
    import uuid, time

    max_wait = 600  # 最多等 10 分钟
    interval = 10
    elapsed = 0

    while elapsed < max_wait:
        await asyncio.sleep(interval)
        elapsed += interval
        try:
            url = f"{settings.video_api_base_url}/{task_id}"
            headers = {"Authorization": f"Bearer {settings.video_api_key}"}
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, headers=headers)
                data = resp.json()
            
            # 类型检查：确保 data 是字典
            if not isinstance(data, dict):
                logger.error(f"Invalid response type for task {task_id}: {type(data)}, data: {data}")
                continue

            status = data.get("status", "")
            logger.info(f"Video task {task_id} status: {status}")

            if status == "succeeded":
                # 获取视频 URL（响应结构：content.video_url）
                video_url = None
                content = data.get("content", {})
                if isinstance(content, dict):
                    video_url = content.get("video_url")
                elif isinstance(content, list):
                    for item in content:
                        if item.get("type") == "video_url":
                            video_url = item.get("video_url", {}).get("url")
                            break

                if not video_url:
                    logger.error(f"No video URL in task {task_id}")
                    return

                # 写入数据库
                async for db in get_db():
                    shot = await db.get(Shot, shot_id)
                    if not shot:
                        return

                    # 创建 FileItem，storage_key 存视频 URL
                    file_id = str(uuid.uuid4())
                    storage_key = video_url  # 直接存完整 URL
                    db.add(FileItem(
                        id=file_id,
                        type="video",
                        name=f"video_{shot_id}",
                        storage_key=storage_key,
                        thumbnail="",
                        tags=[],
                    ))

                    # 更新 Shot
                    shot.generated_video_file_id = file_id
                    shot.status = "ready"
                    await db.commit()
                    logger.info(f"Video saved for shot {shot_id}: {video_url}")
                return

            elif status in ("failed", "cancelled"):
                logger.error(f"Video task {task_id} failed: {data.get('error')}")
                return

        except Exception as e:
            logger.error(f"Poll error for task {task_id}: {e}")

    logger.error(f"Video task {task_id} timed out")


@router.post(
    "/shots/{shot_id}/video-generation-task",
    response_model=ApiResponse[dict],
    status_code=201,
    summary="镜头视频生成（图生视频）",
)
async def create_video_generation_task(
    shot_id: str,
    body: VideoGenerationRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """基于 first_frame 生成视频，后台轮询完成后写入 shot.generated_video_file_id"""
    if not settings.video_api_key or not settings.video_api_base_url:
        raise HTTPException(status_code=503, detail="Video API not configured")

    # 检查 shot 存在
    shot = await db.get(Shot, shot_id)
    if not shot:
        raise HTTPException(status_code=404, detail="Shot not found")

    # 获取 first_frame URL
    first_frame_url = await _get_frame_url(db, shot_id, "first")
    if not first_frame_url:
        raise HTTPException(status_code=400, detail="first_frame not generated yet")

    # 调用视频生成 API
    import httpx
    prompt = body.prompt or shot.title or "电影质感短片"
    payload = {
        "model": settings.video_api_model,
        "content": [
            {
                "type": "text",
                "text": f"{prompt} --duration {body.duration} --camerafixed false --watermark true"
            },
            {
                "type": "image_url",
                "image_url": {"url": first_frame_url}
            }
        ]
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.video_api_key}"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(settings.video_api_base_url, json=payload, headers=headers)
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"Video API error: {resp.text[:200]}")
        result = resp.json()

    task_id = result.get("id")
    if not task_id:
        raise HTTPException(status_code=502, detail="No task_id returned from Video API")

    # 更新 shot 状态
    shot.status = "generating"
    await db.commit()

    # 后台轮询
    asyncio.create_task(_poll_and_save(shot_id=shot_id, task_id=task_id))

    return success_response({"task_id": task_id, "shot_id": shot_id, "status": "generating"}, code=201)
