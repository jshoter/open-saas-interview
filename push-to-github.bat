@echo off
chcp 65001 >nul
echo ========================================
echo Floatboat 面试任务 - 推送代码到GitHub
echo ========================================
echo.

cd /d "C:\Users\v1\Desktop\interview-project"

echo [1/2] 检查Git状态...
git status
echo.

echo [2/2] 推送到GitHub...
echo 执行命令：git push -u origin main
echo.

git push -u origin main

echo.
echo ========================================
echo 推送完成!
echo.
echo 请访问: https://github.com/jshoter/open-saas-interview/pulls
echo 点击 "New pull request" 创建PR
echo ========================================
pause
