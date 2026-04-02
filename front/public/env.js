// 本地开发：占位文件，避免 /env.js 404；实际后端地址可用 VITE_BACKEND_URL。
// 容器部署时由 Nginx/入口脚本覆盖为：window.__ENV = { BACKEND_URL: "https://..." }
window.__ENV = window.__ENV || {}
