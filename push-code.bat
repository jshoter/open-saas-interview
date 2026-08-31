@echo off
chcp 65001 >nul
echo ========================================
echo Floatboat 面试任务 - 推送代码
echo ========================================
echo.

cd /d "C:\Users\v1\Desktop\interview-project"

echo 正在推送代码到 GitHub...
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
