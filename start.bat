@echo off
echo ========================================
echo Floatboat 面试任务 - 快速启动脚本
echo ========================================
echo.

REM 设置变量
set PROJECT_DIR=C:\Users\v1\Desktop\interview-project
set APP_DIR=%PROJECT_DIR%\template\app

echo [1/5] 进入项目目录...
cd /d "%APP_DIR%"

echo [2/5] 检查Node.js版本...
node --version
npm --version

echo.
echo [3/5] 安装依赖（首次运行需要较长时间）...
if not exist "node_modules" (
    npm install
) else (
    echo node_modules 已存在，跳过安装
)

echo.
echo [4/5] 配置环境变量...
if not exist ".env.server" (
    copy .env.server.example .env.server
    echo 已创建 .env.server，请编辑并添加 OPENAI_API_KEY
) else (
    echo .env.server 已存在
)

echo.
echo [5/5] 启动数据库...
wasp start db

echo.
echo ========================================
echo 数据库启动中...
echo 另开一个终端，运行: wasp start
echo ========================================
pause
