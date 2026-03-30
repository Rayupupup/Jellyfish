"""最终输出编译 Agent：OutputCompilerAgent"""

from __future__ import annotations

from typing import Any

from langchain_core.prompts import PromptTemplate

from app.chains.agents.base import AgentBase
from app.schemas.skills.script_processing import OutputCompileResult

_OUTPUT_COMPILER_SYSTEM_PROMPT = """\
你是\"输出编译员\"。汇总所有Agent输出，生成完整项目JSON、可导出表格、项目总结。
输出 OutputCompileResult，其中 project_json 必须严格符合 ProjectCinematicBreakdown schema（至少包含 source_id/chunks/characters/locations/props/scenes/shots/transitions/notes/uncertainties）。
只输出 JSON。
"""

OUTPUT_COMPILER_PROMPT = PromptTemplate(
    input_variables=["division_json", "all_extractions_json", "merge_json", "variant_json", "consistency_json"],
    template=(
        "## 分镜结果\n{division_json}\n\n"
        "## 所有逐镜提取\n{all_extractions_json}\n\n"
        "## 实体合并\n{merge_json}\n\n"
        "## 变体分析\n{variant_json}\n\n"
        "## 一致性检查\n{consistency_json}\n\n"
        "## 输出\n"
    ),
)


class OutputCompilerAgent(AgentBase[OutputCompileResult]):
    """最终输出打包：输入所有Agent状态，输出完整项目JSON + 表格数据。"""

    @property
    def system_prompt(self) -> str:
        return _OUTPUT_COMPILER_SYSTEM_PROMPT

    @property
    def prompt_template(self) -> PromptTemplate:
        return OUTPUT_COMPILER_PROMPT

    @property
    def output_model(self) -> type[OutputCompileResult]:
        return OutputCompileResult

    def _normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        """规范化输出编译结果。"""
        data = dict(data)
        # 严格输出：project_json 必须能被 ProjectCinematicBreakdown 校验
        if "project_json" not in data or not isinstance(data["project_json"], dict):
            data["project_json"] = {}
        pj = data["project_json"]
        if isinstance(pj, dict):
            # 补齐 ProjectCinematicBreakdown 必填字段
            pj.setdefault("source_id", "unknown_source")
            pj.setdefault("chunks", [])
            pj.setdefault("characters", [])
            pj.setdefault("locations", [])
            pj.setdefault("props", [])
            pj.setdefault("scenes", [])
            pj.setdefault("shots", [])
            pj.setdefault("transitions", [])
            pj.setdefault("notes", [])
            pj.setdefault("uncertainties", [])

        if "tables" not in data or not isinstance(data["tables"], list):
            data["tables"] = []
        if "export_stats" not in data or not isinstance(data["export_stats"], dict):
            data["export_stats"] = {
                "total_tables": len(data["tables"]),
                "total_rows": sum(t.get("row_count", 0) for t in data["tables"]),
            }
        return data

