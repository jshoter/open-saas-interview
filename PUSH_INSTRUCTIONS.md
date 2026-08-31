# Floatboat 面试任务 - 推送命令

## 当前状态
- 分支：`main`（已重命名）
- 提交：1个commit

---

## 推送命令

在 **Windows Git Bash** 执行：

```bash
cd "C:\Users\v1\Desktop\interview-project"

# 确认当前分支
git branch

# 推送
git push -u origin main
```

---

## 如果还报错，试试这个

```bash
# 强制推送（如果远程有冲突）
git push -u origin main --force

# 或者直接指定当前分支
git push -u origin HEAD
```

---

## 完成PR

推送成功后：
1. 访问：https://github.com/jshoter/open-saas-interview
2. 点击 "Compare & pull request"
3. 标题：`feat: add HTML animation to video generation`
4. 描述：复制 README.md 里的 PR Description 部分
