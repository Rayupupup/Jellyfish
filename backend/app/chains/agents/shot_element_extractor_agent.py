"""逐镜元素提取 Agent：ShotElementExtractorAgent"""

from __future__ import annotations

from typing import Any

from langchain_core.prompts import PromptTemplate

from app.chains.agents.base import AgentBase
from app.schemas.skills.script_processing import ShotElementExtractionResult

_ELEMENT_EXTRACTOR_SYSTEM_PROMPT = """\
你是\"镜头元素提取员\"。从单个镜头提取关键信息：
- character_keys、scene_keys、costume_keys、prop_keys（弱ID/归一化名；稳定ID由后续合并阶段统一分配）
- characters_detailed（每个角色含 character_key/name_in_text/appearance/clothing/accessories/state + raw_* 溯源，可选 evidence）
- props_detailed（每个道具含 prop_key/name_in_text/description/state/interaction + raw_text，可选 evidence）
- scene_detailed（scene_key/name/location_detail/atmosphere/time_weather/raw_description_text，可选 evidence）
- dialogue_lines（结构化对白，字段与 schemas.DialogueLine 对齐）
- actions、shot_type_hints、confidence_breakdown
其中 dialogue_lines 每项必须包含 text/line_mode；建议包含 index/speaker_character_id/target_character_id（若可判定）。
严格按照原文，不要编造。只输出 JSON，符合 ShotElementExtractionResult 结构。
"""

ELEMENT_EXTRACTOR_PROMPT = PromptTemplate(
    input_variables=["index", "shot_text", "context_summary", "shot_division_json"],
    template=(
        "镜头号: {index}\n"
        "分镜元信息(来自上一步): {shot_division_json}\n"
        "上文: {context_summary}\n\n"
        "## 镜头文本\n{shot_text}\n\n"
        "## 输出\n"
    ),
)


class ShotElementExtractorAgent(AgentBase[ShotElementExtractionResult]):
    """[兼容] 逐镜信息提取：输入单镜文本+上文摘要，输出该镜的结构化提取结果。"""

    @property
    def system_prompt(self) -> str:
        return _ELEMENT_EXTRACTOR_SYSTEM_PROMPT

    @property
    def prompt_template(self) -> PromptTemplate:
        return ELEMENT_EXTRACTOR_PROMPT

    @property
    def output_model(self) -> type[ShotElementExtractionResult]:
        return ShotElementExtractionResult

    def _normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        """规范化元素提取结果（升级版结构）。"""
        data = dict(data)
        # 兼容：缺失 shot_division
        if "shot_division" not in data:
            data["shot_division"] = None
        if "elements" not in data or not isinstance(data["elements"], dict):
            data["elements"] = {}

        elements = data["elements"]

        # 兼容旧字段名：*_ids -> *_keys
        legacy_key_map = {
            "character_ids": "character_keys",
            "scene_ids": "scene_keys",
            "costume_ids": "costume_keys",
            "prop_ids": "prop_keys",
        }
        for old, new in legacy_key_map.items():
            if old in elements and new not in elements:
                val = elements.get(old)
                if isinstance(val, list):
                    elements[new] = [str(x) for x in val]
                elements.pop(old, None)

        # 兼容旧字段名：dialog_lines -> dialogue_lines
        if "dialog_lines" in elements and "dialogue_lines" not in elements:
            elements["dialogue_lines"] = elements.pop("dialog_lines")

        for key in (
            "character_keys",
            "scene_keys",
            "costume_keys",
            "prop_keys",
            "characters_detailed",
            "props_detailed",
            "dialogue_lines",
            "actions",
            "shot_type_hints",
        ):
            if key not in elements or not isinstance(elements[key], list):
                elements[key] = []

        if "scene_detailed" not in elements:
            elements["scene_detailed"] = None
        elif elements["scene_detailed"] is not None and not isinstance(elements["scene_detailed"], dict):
            elements["scene_detailed"] = None

        if "confidence_breakdown" not in elements or not isinstance(elements["confidence_breakdown"], dict):
            elements["confidence_breakdown"] = {}

        # 兼容旧结构：characters_detailed/props_detailed/scene_detailed 里字段名 *_id -> *_key
        for c in elements.get("characters_detailed", []) or []:
            if isinstance(c, dict) and "character_id" in c and "character_key" not in c:
                c["character_key"] = str(c.pop("character_id"))
            if isinstance(c, dict) and "evidence" not in c:
                c["evidence"] = []

        for p in elements.get("props_detailed", []) or []:
            if isinstance(p, dict) and "prop_id" in p and "prop_key" not in p:
                p["prop_key"] = str(p.pop("prop_id"))
            if isinstance(p, dict) and "evidence" not in p:
                p["evidence"] = []

        sd = elements.get("scene_detailed")
        if isinstance(sd, dict) and "scene_id" in sd and "scene_key" not in sd:
            sd["scene_key"] = str(sd.pop("scene_id"))
        if isinstance(sd, dict) and "evidence" not in sd:
            sd["evidence"] = []

        # 兼容旧对白行结构：补齐 schemas.DialogueLine 的可选字段
        dl = elements.get("dialogue_lines")
        if isinstance(dl, list):
            for line in dl:
                if not isinstance(line, dict):
                    continue
                if "index" not in line and "order" in line:
                    line["index"] = line.pop("order")
                if "evidence" not in line:
                    line["evidence"] = []
                # 确保 line_mode 合法字符串（由 schema Literal 校验）
                if "line_mode" not in line:
                    line["line_mode"] = "DIALOGUE"

        data["elements"] = elements

        if "confidence" not in data:
            data["confidence"] = None

        return data

