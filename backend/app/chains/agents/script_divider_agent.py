"""剧本分镜 Agent：ScriptDividerAgent"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.prompts import PromptTemplate

from app.chains.agents.base import AgentBase, _extract_json_from_text
from app.schemas.skills.script_processing import ScriptDivisionResult

_SCRIPT_DIVIDER_SYSTEM_PROMPT = """\
你是\"剧本分镜师\"。将完整剧本分割为多个镜头。每个镜头应是完整的连贯场景。
为每个镜头提供：
- index（镜头序号，章节内唯一；从 1 开始）
- start_line、end_line
- shot_name（镜头名称/镜头标题，分镜名；一句话描述该镜头画面/动作；不要把它当作场景名）
- script_excerpt（镜头对应的剧本摘录/文本）
- scene_name（场景名称，必须与 shots 中 scene_name 的含义一致；不要把 shot_name 当成 scene_name）
- time_of_day
- character_names_in_text（角色名/称呼，弱信息；稳定ID会在后续合并阶段统一分配）
严格区分字段含义：
- shot_name = 分镜名/镜头标题
- scene_name = 场景名
只输出 JSON，符合 ScriptDivisionResult 结构。
"""

SCRIPT_DIVIDER_PROMPT = PromptTemplate(
    input_variables=["script_text"],
    template="## 输入脚本\n{script_text}\n\n## 输出\n",
)


class ScriptDividerAgent(AgentBase[ScriptDivisionResult]):
    """剧本自动分镜：输入完整剧本文本，输出分镜列表。"""

    @property
    def system_prompt(self) -> str:
        return _SCRIPT_DIVIDER_SYSTEM_PROMPT

    @property
    def prompt_template(self) -> PromptTemplate:
        return SCRIPT_DIVIDER_PROMPT

    @property
    def output_model(self) -> type[ScriptDivisionResult]:
        return ScriptDivisionResult

    def format_output(self, raw: str) -> ScriptDivisionResult:
        """
        更强的兜底解析：
        LLM 可能输出：
        - 正常结构：{shots:[...], total_shots:N}
        - 包裹结构：{"ScriptDivisionResult": {...}}
        - 直接列表：[{...}, {...}]（视为 shots）
        """

        json_str = _extract_json_from_text(raw)
        data: Any = json.loads(json_str)

        if isinstance(data, list):
            data = {"shots": data}
        elif isinstance(data, dict) and "ScriptDivisionResult" in data:
            inner = data.get("ScriptDivisionResult")
            if isinstance(inner, list):
                data = {"shots": inner}
            elif isinstance(inner, dict):
                data = inner
            else:
                data = {"shots": []}

        if isinstance(data, dict):
            data = self._normalize(data)

        return self.output_model.model_validate(data)  # type: ignore[arg-type]

    def divide_script(self, *, script_text: str) -> ScriptDivisionResult:
        return self.extract(script_text=script_text)

    async def adivide_script(self, *, script_text: str) -> ScriptDivisionResult:
        return await self.aextract(script_text=script_text)

    def _normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        """规范化脚本分割结果。"""
        data = dict(data)

        # 兼容：LLM 可能输出 {"ScriptDivisionResult": {...}} 或 {"ScriptDivisionResult": [...]}
        if "ScriptDivisionResult" in data:
            inner = data.get("ScriptDivisionResult")
            if isinstance(inner, list):
                data = {"shots": inner}
            elif isinstance(inner, dict):
                data = dict(inner)
            else:
                data = {"shots": []}

        if "shots" in data and isinstance(data["shots"], list):
            shots = []
            for idx, shot in enumerate(data["shots"]):
                shot_dict: dict[str, Any] = (
                    dict(shot) if isinstance(shot, dict) else {"script_excerpt": str(shot), "shot_name": ""}
                )
                if "index" not in shot_dict:
                    shot_dict["index"] = idx + 1
                # 兼容：LLM 可能用 title/shot_title 代替 shot_name
                if "shot_name" not in shot_dict:
                    if "title" in shot_dict:
                        shot_dict["shot_name"] = str(shot_dict.pop("title"))
                    elif "shot_title" in shot_dict:
                        shot_dict["shot_name"] = str(shot_dict.pop("shot_title"))
                shot_dict.setdefault("shot_name", "")
                # 兼容旧字段：character_ids -> character_names_in_text（此阶段为弱信息）
                if "character_ids" in shot_dict and "character_names_in_text" not in shot_dict:
                    val = shot_dict.get("character_ids")
                    if isinstance(val, list):
                        shot_dict["character_names_in_text"] = [str(x) for x in val]
                    shot_dict.pop("character_ids", None)
                shots.append(shot_dict)
            data["shots"] = shots

        if "total_shots" not in data and "shots" in data:
            data["total_shots"] = len(data["shots"])

        return data

