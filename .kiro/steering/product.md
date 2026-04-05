# Product: Jellyfish AI Short Drama Studio

Jellyfish is an end-to-end AI-powered production tool for vertical short-form dramas (微短剧). It takes a script as input and guides the user through the full production pipeline:

**Script → Storyboard → Asset Management → AI Video Generation → Timeline Editing → Export**

## Core Modules

- **Project Management** — global style/seed control to prevent character/scene drift across shots
- **Chapter Workbench** — script input, AI storyboard extraction, shot editing, video generation
- **Shot Control** — fine-grained shot parameters: framing, angle, camera movement, emotion, duration, dialog, music, SFX
- **Asset Management** — actors, scenes, props, costumes; project-level and global asset libraries
- **Prompt Template Library** — reusable templates for shots, characters, scenes, video, audio
- **Timeline Editor** — multi-track video/audio editing, drag-and-drop, final export
- **Agent Workflow** — node-based LangGraph workflows for script parsing, entity extraction, storyboard suggestions
- **Model Management** — multi-provider LLM/image/video model configuration (OpenAI, Claude, Kling, Runway, etc.)

## Target Users

Short drama creators, AI film studios, individual creators, brand/e-commerce video producers.
