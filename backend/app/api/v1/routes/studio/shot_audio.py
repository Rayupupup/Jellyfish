"""镜头音频生成 API"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.studio_shots import ShotDetail, ShotDialogLine
from app.schemas.common import ApiResponse, success_response
from app.services.tts_service import TTSService
from app.services.s3_service import S3Service
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/studio/shots", tags=["studio/shots"])


class GenerateShotAudioRequest(BaseModel):
    """生成镜头音频请求"""
    shot_id: str = Field(..., description="镜头ID")
    voice_type: str = Field("BV700_streaming", description="音色类型")
    speed_ratio: float = Field(1.0, ge=0.5, le=2.0, description="语速")


class GenerateShotAudioResponse(BaseModel):
    """生成镜头音频响应"""
    shot_id: str
    audio_url: Optional[str] = None
    audio_segments: list[dict] = Field(default_factory=list)
    message: str = ""


@router.post(
    "/{shot_id}/generate-audio",
    response_model=ApiResponse[GenerateShotAudioResponse],
    summary="生成镜头音频（TTS）",
)
async def generate_shot_audio(
    shot_id: str,
    request: GenerateShotAudioRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[GenerateShotAudioResponse]:
    """
    为镜头的所有对白生成 TTS 音频
    
    流程：
    1. 查询镜头的所有对白
    2. 对每条对白调用 TTS
    3. 将音频片段上传到 S3
    4. 返回音频 URL 和时间轴信息
    """
    try:
        # 检查 TTS 配置
        if not settings.tts_app_id or not settings.tts_token:
            raise HTTPException(
                status_code=503,
                detail="TTS not configured. Set TTS_APP_ID and TTS_TOKEN in .env",
            )

        # 查询镜头和对白
        stmt = (
            select(ShotDetail)
            .where(ShotDetail.id == shot_id)
        )
        result = await db.execute(stmt)
        shot = result.scalar_one_or_none()

        if not shot:
            raise HTTPException(status_code=404, detail="Shot not found")

        # 查询对白
        stmt = (
            select(ShotDialogLine)
            .where(ShotDialogLine.shot_detail_id == shot_id)
            .order_by(ShotDialogLine.index)
        )
        result = await db.execute(stmt)
        dialog_lines = result.scalars().all()

        if not dialog_lines:
            return success_response(
                data=GenerateShotAudioResponse(
                    shot_id=shot_id,
                    message="No dialog lines found",
                )
            )

        # 初始化 TTS 服务
        tts = TTSService(
            app_id=settings.tts_app_id,
            token=settings.tts_token,
            cluster=settings.tts_cluster or "volcano_tts",
        )

        # 生成每条对白的音频
        audio_segments = []
        current_time = 0.0  # 累计时间

        for line in dialog_lines:
            audio_bytes = await tts.synthesize(
                text=line.text,
                voice_type=request.voice_type,
                speed_ratio=request.speed_ratio,
            )

            if audio_bytes:
                audio_segments.append({
                    "index": line.index,
                    "text": line.text,
                    "start": current_time,
                    "audio_bytes": audio_bytes,
                    "duration": len(audio_bytes) / 16000,  # 粗略估算
                })
                current_time += len(audio_bytes) / 16000 + 0.5  # 加0.5秒间隔

        if not audio_segments:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate any audio",
            )

        # TODO: 合并所有音频片段并上传到 S3
        # 现在先返回片段信息

        return success_response(
            data=GenerateShotAudioResponse(
                shot_id=shot_id,
                audio_segments=[
                    {
                        "index": seg["index"],
                        "text": seg["text"],
                        "start": seg["start"],
                        "duration": seg["duration"],
                    }
                    for seg in audio_segments
                ],
                message=f"Generated {len(audio_segments)} audio segments",
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"generate_shot_audio failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate audio: {str(e)}",
        )
