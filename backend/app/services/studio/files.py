import tempfile
from pathlib import Path
from urllib.parse import quote

from fastapi import Depends
from fastapi.background import BackgroundTask
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.core.storage import storage
from app.models.studio import FileItem, FileUsage
from app.schemas.common import created_response, success_response
from app.schemas.studio import FileCreate, FileRead, FileUsageCreate
from app.services.common import entity_not_found, get_or_404, require_entity


async def list_files(
    db: AsyncSession,
    *,
    project_id: str | None = None,
    chapter_id: str | None = None,
    shot_id: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> list[FileRead]:
    """列出文件，可选按项目/章节/镜头过滤。"""
    stmt = select(FileItem)

    if project_id:
        stmt = stmt.where(FileItem.project_id == project_id)
    if chapter_id:
        stmt = stmt.where(FileItem.chapter_id == chapter_id)
    if shot_id:
        stmt = stmt.where(FileItem.shot_id == shot_id)

    result = await db.execute(stmt.offset((page - 1) * page_size).limit(page_size))
    items = result.scalars().all()
    return [FileRead.model_validate(x) for x in items]


async def create_file(
    db: AsyncSession,
    *,
    data: FileCreate,
) -> FileRead:
    """创建文件记录。"""
    obj = FileItem(
        **data.model_dump(),
    )
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return FileRead.model_validate(obj)


async def get_file(
    db: AsyncSession,
    *,
    file_id: str,
) -> FileRead:
    """获取单个文件详情。"""
    obj = await get_or_404(db, FileItem, file_id, detail=entity_not_found("File"))
    return FileRead.model_validate(obj)


async def delete_file(
    db: AsyncSession,
    *,
    file_id: str,
) -> None:
    """删除文件（同时清理存储）。"""
    obj = await get_or_404(db, FileItem, file_id, detail=entity_not_found("File"))
    # 先删除存储对象
    await storage.delete_file(key=obj.storage_key)
    # 再删除数据库记录
    await db.delete(obj)
    await db.flush()


def _resolve_download_media_type(filename: str) -> str:
    """根据文件名推断 media_type。"""
    ext = Path(filename).suffix.lower()
    mapping = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }
    return mapping.get(ext, "application/octet-stream")


async def _cleanup_temp_file(path: str):
    """清理临时文件"""
    import os
    try:
        os.unlink(path)
    except:
        pass


async def build_download_response(
    db: AsyncSession,
    *,
    file_id: str,
):
    """根据 file_id 构建下载响应。"""
    import httpx
    
    file_item = await get_or_404(db, FileItem, file_id, detail=entity_not_found("File"))
    
    storage_key = file_item.storage_key
    filename = Path(storage_key).name or "download"
    media_type = _resolve_download_media_type(filename)
    
    # 如果 storage_key 是完整 URL（外部存储），使用 302 重定向
    if storage_key.startswith(("http://", "https://")):
        # 对于外部URL，返回重定向到S3
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=storage_key, status_code=302)
    
    # 否则从本地 S3 下载
    content = await storage.download_file(key=storage_key)
    content_disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return StreamingResponse(
        iter([content]),
        media_type=media_type,
        headers={"Content-Disposition": content_disposition},
    )


async def get_storage_info(
    db: AsyncSession,
    *,
    file_id: str,
) -> dict[str, Any]:
    """读取对象存储信息。"""
    file_item = await get_or_404(db, FileItem, file_id, detail=entity_not_found("File"))
    return await storage.head_object(key=file_item.storage_key)


async def record_file_usage(
    db: AsyncSession,
    *,
    file_id: str,
    data: FileUsageCreate,
) -> FileUsage:
    """记录文件使用情况。"""
    # 验证文件存在
    await require_entity(db, FileItem, file_id, detail=entity_not_found("File"))
    
    usage = FileUsage(
        file_id=file_id,
        project_id=data.project_id,
        chapter_id=data.chapter_id,
        shot_id=data.shot_id,
        usage_kind=data.usage_kind,
        source_ref=data.source_ref,
    )
    db.add(usage)
    await db.flush()
    await db.refresh(usage)
    return usage
