@echo off
echo 正在启动视频转文本服务...
echo.

REM 检查Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查npm依赖
if not exist node_modules (
    echo 正在安装依赖...
    npm install
    if errorlevel 1 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查环境变量文件
if not exist .env (
    echo 正在创建环境配置文件...
    copy env.example .env
    echo.
    echo 请编辑 .env 文件，添加你的 GEMINI_API_KEY
    echo 然后重新运行此脚本
    pause
    exit /b 0
)

REM 启动服务
echo 启动服务器...
echo 项目已升级为ES6模块
echo 浏览器将自动打开 http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.
start http://localhost:3000
npm start
