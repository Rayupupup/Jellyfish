# 阶段1: 构建前端
FROM node:22-slim AS frontend-builder
WORKDIR /app/front

# 复制前端依赖文件
COPY front/package*.json ./
RUN npm install -g pnpm && pnpm install

# 复制前端代码并构建
COPY front/ .
RUN pnpm run build

# 阶段2: 构建后端运行环境
FROM python:3.11-slim AS final
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 复制整个项目
COPY . .

# 切换到后端目录
WORKDIR /app/backend

# 安装依赖
RUN uv sync --frozen --no-cache

# 复制构建好的前端
COPY --from=frontend-builder /app/front/dist /app/backend/static

# 复制环境变量示例
RUN cp .env.example .env

# 暴露端口
EXPOSE 8000

# 初始化数据库并启动服务
CMD ["sh", "-c", "uv run python init_db.py && uv run python init_storage.py && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
