# Jellyfish AI Short Drama Studio

<p align="center">
  <img src="./logo.svg" alt="Jellyfish Logo" width="160" />
</p>

<p align="center">
  <a href="./README.md">简体中文</a> ·
  <a href="./README.en.md">English</a>
</p>

An end-to-end production tool for AI-generated short dramas (vertical / micro drama).  
From script input → storyboard extraction → character/scene/prop consistency management → AI video generation → post-production editing → one-click export.

## 📷 Screenshots

| Project overview | Asset management |
| --- | --- |
| <img src="./static/img/docs/project.png" alt="Project overview" width="420" /> | <img src="./static/img/docs/%E8%B5%84%E4%BA%A7%E7%AE%A1%E7%90%86.png" alt="Asset management" width="420" /> |

## ✨ Core Value

- **Consistency first**: global seed + unified style + asset reuse, tackling the #1 pain point in AI generation—character/scene drift
- **Industrialized workflow**: from a narrative script to shootable storyboards, then to video clips—an end-to-end closed loop
- **Visual & controllable**: WYSIWYG storyboard editor + fine-grained cinematography controls + real-time preview
- **Asset reuse system**: full lifecycle management of characters/scenes/props/costumes/prompt templates

## 🚀 Key Features

| Module | Core capabilities | Highlights |
| --- | --- | --- |
| Project management | Create projects, unified global style/seed, dashboards, chapter stats | Global seed to reduce drift, enforced style inheritance |
| Chapter production workspace | Script input → smart condense → storyboard extraction → storyboard editing → video generation → preview | Three-column layout, collapsible right panel, batch ops |
| Storyboard fine controls | Shot size/angle/movement/emotion/duration/atmosphere/dialog/music/SFX/hidden shots | Separate prompts for first/last/key frames, multi-version management |
| Advanced generation controls | Reference images across shots, ControlNet (pose/depth), lip-sync, model & duration selection | Controllable motion + lip-sync |
| Asset management | Centralized character/scene/prop/costume management, smart extraction + manual linking + prompt templates | Dual-layer: per-project vs global asset library |
| Prompt template library | Templates for storyboard/character/scene/video/music/SFX/composite prompts | One-click bootstrap for new chapters |
| Post-production editing | Timeline editing, multi-track video/audio, drag-drop asset bin, final export | Edit full episodes directly from AI clips |
| Agent workflows | Custom agents (plot extraction / character extraction / storyboard suggestions), visual orchestration & testing | Node-based workflow editor (Dify-like) |
| Model management | Multi-provider management (OpenAI/Claude/Tongyi/Hunyuan...), model categories (text/image/video) | Per-category defaults, quick connection tests |
| Generated media management | Unified preview for images/videos, tagging, filtering, batch export | Reuse high-quality assets efficiently |

## 🎯 Use Cases

- Short drama / micro-drama creators
- AI film studios producing at scale
- Solo creators testing vertical dramas on a budget
- Education & training teams producing teaching videos
- Brands / e-commerce teams creating story-driven product promos

## 🛠 Tech Stack (Example)

- Frontend: React 18 + TypeScript + Vite + Ant Design / Tailwind CSS
- State: Redux Toolkit / Zustand
- Workflow editor: React Flow
- Video player: Video.js / Plyr
- Rich text / code editor: Monaco Editor / React Quill
- Backend (optional open-source part): Node.js / NestJS / FastAPI / Spring Boot
- AI layer: multiple model APIs (OpenAI / Anthropic / Midjourney / Runway / Kling / Luma, etc.)

## 🚧 Current Status

Prototype in planning:

- [x] Project creation & global settings
- [x] Core chapter workspace
- [x] Asset & prompt template management
- [x] Storyboard fine editing & video generation controls
- [ ] Full post-production timeline (in progress)
- [ ] Visual Agent orchestration (partially done)
- [ ] Multi-model provider management (in progress)
- [ ] Mobile adaptation (planned)

## 📄 License

MIT License

PRs, issues, and stars are welcome.  
Also welcome collaborators who want to build an industry-leading AI short drama production tool together.

## 💬 Community & Feedback

- GitHub Issues
- WeChat group / Discord (TBD)
