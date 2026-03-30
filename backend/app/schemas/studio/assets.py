"""资产（Scene/Prop/Costume）及其图片表的 schemas。"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.studio import AssetQualityLevel, AssetViewAngle, ProjectStyle, ProjectVisualStyle


class AssetBase(BaseModel):
    id: str = Field(..., description="资产 ID")
    name: str = Field(..., description="名称")
    description: str = Field("", description="描述")
    tags: list[str] = Field(default_factory=list, description="标签")
    prompt_template_id: str | None = Field(None, description="提示词模板 ID（可空）")
    view_count: int = Field(1, ge=1, description="计划为该资产生成的视角图片数量（不含分镜帧）")
    style: ProjectStyle = Field(ProjectStyle.real_people_city, description="题材/风格")
    visual_style: ProjectVisualStyle = Field(ProjectVisualStyle.live_action, description="画面表现形式（现实/动漫等）")


class AssetCreate(BaseModel):
    id: str
    name: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    prompt_template_id: str | None = None
    view_count: int = Field(1, ge=1)
    style: ProjectStyle = ProjectStyle.real_people_city
    visual_style: ProjectVisualStyle = ProjectVisualStyle.live_action


class AssetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    prompt_template_id: str | None = None
    view_count: int | None = Field(None, ge=1)
    style: ProjectStyle | None = None
    visual_style: ProjectVisualStyle | None = None


class AssetRead(AssetBase):
    thumbnail: str = Field("", description="缩略图下载地址")

    class Config:
        from_attributes = True


class AssetImageBase(BaseModel):
    id: int = Field(..., description="图片行 ID")
    quality_level: AssetQualityLevel = Field(AssetQualityLevel.low, description="精度等级")
    view_angle: AssetViewAngle = Field(AssetViewAngle.front, description="视角")
    file_id: str | None = Field(None, description="关联的 FileItem ID（可空，支持先创建槽位后填充）")
    width: int | None = Field(None, description="宽(px)")
    height: int | None = Field(None, description="高(px)")
    format: str = Field("png", description="格式")


class AssetImageCreate(BaseModel):
    quality_level: AssetQualityLevel = AssetQualityLevel.low
    view_angle: AssetViewAngle = AssetViewAngle.front
    file_id: str | None = None
    width: int | None = None
    height: int | None = None
    format: str = "png"


class AssetImageUpdate(BaseModel):
    quality_level: AssetQualityLevel | None = None
    view_angle: AssetViewAngle | None = None
    file_id: str | None = None
    width: int | None = None
    height: int | None = None
    format: str | None = None


class SceneRead(AssetRead):
    pass


class PropRead(AssetRead):
    pass


class CostumeRead(AssetRead):
    pass


class SceneImageRead(AssetImageBase):
    scene_id: str

    class Config:
        from_attributes = True


class PropImageRead(AssetImageBase):
    prop_id: str

    class Config:
        from_attributes = True


class CostumeImageRead(AssetImageBase):
    costume_id: str

    class Config:
        from_attributes = True


class CharacterImageRead(AssetImageBase):
    character_id: str

    class Config:
        from_attributes = True

