#!/bin/bash

echo "正在启动视频转文本服务..."
echo

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "警告: 未找到FFmpeg，请确保已安装FFmpeg"
    echo "Ubuntu/Debian: sudo apt install ffmpeg"
    echo "macOS: brew install ffmpeg"
    echo
fi

# 检查npm依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败"
        exit 1
    fi
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "正在创建环境配置文件..."
    cp env.example .env
    echo
    echo "请编辑 .env 文件，添加你的 GEMINI_API_KEY"
    echo "然后重新运行此脚本"
    exit 0
fi

# 启动服务
echo "启动服务器..."
echo "项目已升级为ES6模块"
echo "浏览器将在 http://localhost:3000 打开"
echo "按 Ctrl+C 停止服务器"
echo

# 尝试打开浏览器
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 &
elif command -v open &> /dev/null; then
    open http://localhost:3000 &
fi

npm start
