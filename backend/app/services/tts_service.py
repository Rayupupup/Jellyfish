"""音频合成服务 - 对白TTS + 视频合并音频"""

from __future__ import annotations

import base64
import logging
import os
import tempfile
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class TTSService:
    """火山引擎 TTS 服务"""

    def __init__(self, app_id: str, token: str, cluster: str = "volcano_tts"):
        self.app_id = app_id
        self.token = token
        self.cluster = cluster
        self.base_url = "https://openspeech.bytedance.com/api/v1/tts"

    async def synthesize(
        self,
        text: str,
        voice_type: str = "BV700_streaming",
        speed_ratio: float = 1.0,
        volume_ratio: float = 1.0,
    ) -> Optional[bytes]:
        """合成语音，返回 MP3 字节"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer;{self.token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "app": {
                            "appid": self.app_id,
                            "token": self.token,
                            "cluster": self.cluster,
                        },
                        "user": {"uid": "jellyfish"},
                        "audio": {
                            "voice_type": voice_type,
                            "encoding": "mp3",
                            "speed_ratio": speed_ratio,
                            "volume_ratio": volume_ratio,
                        },
                        "request": {
                            "reqid": str(uuid.uuid4()),
                            "text": text,
                            "text_type": "plain",
                            "operation": "query",
                        },
                    },
                )
                data = resp.json()
                if data.get("code") == 3000:
                    return base64.b64decode(data["data"])
                logger.error(f"TTS error: {data.get('message')}")
                return None
        except Exception as e:
            logger.error(f"TTS failed: {e}")
            return None
