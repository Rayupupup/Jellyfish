"""视频生成服务 - 火山引擎图生视频"""
import httpx
from app.core.config import settings

async def create_video_generation_task(
    first_frame_url: str,
    last_frame_url: str,
    prompt: str,
    duration: int = 5
) -> dict:
    """创建视频生成任务（图生视频）"""
    url = settings.video_api_base_url
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.video_api_key}"
    }
    
    payload = {
        "model": settings.video_api_model,
        "content": [
            {
                "type": "text",
                "text": f"{prompt} --duration {duration} --camerafixed false --watermark true"
            },
            {
                "type": "image_url",
                "image_url": {"url": first_frame_url}
            }
        ]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

async def get_video_task_status(task_id: str) -> dict:
    """查询视频生成任务状态"""
    url = f"{settings.video_api_base_url}/{task_id}"
    headers = {"Authorization": f"Bearer {settings.video_api_key}"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
