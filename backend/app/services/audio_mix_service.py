"""音频合成服务 - 将对白TTS音频合并到视频"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


class AudioMixService:
    """将 TTS 音频合并到视频"""

    async def mix_audio_to_video(
        self,
        video_path: str,
        audio_segments: list[dict],  # [{"start": 0.0, "audio_bytes": b"..."}]
        output_path: str,
        bgm_path: Optional[str] = None,
        bgm_volume: float = 0.15,
    ) -> bool:
        """
        将多段 TTS 音频合并到视频

        Args:
            video_path: 输入视频路径
            audio_segments: 音频片段列表，每项含 start（秒）和 audio_bytes（MP3字节）
            output_path: 输出视频路径
            bgm_path: 背景音乐路径（可选）
            bgm_volume: 背景音乐音量（0-1）
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            # 1. 写入所有音频片段
            audio_files = []
            for i, seg in enumerate(audio_segments):
                audio_path = os.path.join(tmpdir, f"seg_{i}.mp3")
                with open(audio_path, "wb") as f:
                    f.write(seg["audio_bytes"])
                audio_files.append({"path": audio_path, "start": seg["start"]})

            # 2. 用 ffmpeg 合并音频到视频
            if not audio_files:
                return False

            # 构建 ffmpeg 命令
            cmd = ["ffmpeg", "-y", "-i", video_path]

            # 添加所有音频输入
            for af in audio_files:
                cmd += ["-i", af["path"]]

            if bgm_path:
                cmd += ["-i", bgm_path]

            # 构建 filter_complex
            filters = []
            n_audio = len(audio_files)

            # 每段音频延迟到对应时间点
            for i, af in enumerate(audio_files):
                delay_ms = int(af["start"] * 1000)
                filters.append(f"[{i+1}:a]adelay={delay_ms}|{delay_ms}[a{i}]")

            # 混合所有音频
            mix_inputs = "".join(f"[a{i}]" for i in range(n_audio))

            if bgm_path:
                bgm_idx = n_audio + 1
                filters.append(f"[{bgm_idx}:a]volume={bgm_volume}[bgm]")
                filters.append(f"{mix_inputs}[bgm]amix=inputs={n_audio+1}:normalize=0[aout]")
            else:
                filters.append(f"{mix_inputs}amix=inputs={n_audio}:normalize=0[aout]")

            filter_complex = ";".join(filters)

            cmd += [
                "-filter_complex", filter_complex,
                "-map", "0:v",
                "-map", "[aout]",
                "-c:v", "copy",
                "-c:a", "aac",
                "-shortest",
                output_path,
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode != 0:
                    logger.error(f"ffmpeg mix failed: {result.stderr}")
                    return False
                return True
            except Exception as e:
                logger.error(f"Audio mix failed: {e}")
                return False

    async def add_subtitles(
        self,
        video_path: str,
        subtitles: list[dict],  # [{"start": 0.0, "end": 2.0, "text": "..."}]
        output_path: str,
        font_size: int = 24,
        font_color: str = "white",
    ) -> bool:
        """
        将字幕烧录到视频

        Args:
            video_path: 输入视频路径
            subtitles: 字幕列表
            output_path: 输出视频路径
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            # 生成 SRT 字幕文件
            srt_path = os.path.join(tmpdir, "subtitles.srt")
            with open(srt_path, "w", encoding="utf-8") as f:
                for i, sub in enumerate(subtitles):
                    start = self._seconds_to_srt_time(sub["start"])
                    end = self._seconds_to_srt_time(sub["end"])
                    f.write(f"{i+1}\n{start} --> {end}\n{sub['text']}\n\n")

            # ffmpeg 烧录字幕
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-vf", f"subtitles={srt_path}:force_style='FontSize={font_size},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=1'",
                "-c:a", "copy",
                output_path,
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if result.returncode != 0:
                    logger.error(f"ffmpeg subtitle failed: {result.stderr}")
                    return False
                return True
            except Exception as e:
                logger.error(f"Subtitle burn failed: {e}")
                return False

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """秒数转 SRT 时间格式 HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
