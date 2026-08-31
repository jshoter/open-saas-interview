@echo off
chcp 65001 >nul
echo ========================================
echo Floatboat 面试任务 - 推送代码
echo ========================================
echo.

cd /d "C:\Users\v1\Desktop\interview-project"

echo [1/3] 当前Git状态:
git status
echo.

echo [2/3] 当前分支:
git branch
echo.

echo [3/3] 提交历史:
git log --oneline
echo.

echo ========================================
echo 请执行以下命令推送代码:
echo.
echo   git push -u origin main
echo.
echo ========================================
pause
