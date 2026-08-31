# Floatboat 面试任务

## ✅ 项目已完成

**Git提交（单个）：**
```
feat: add HTML animation to video generation
```

---

## 📝 创建Pull Request

### 强制推送（更新GitHub）

```bash
cd "C:\Users\v1\Desktop\interview-project"
git push -u origin main --force
```

### 创建PR

访问：https://github.com/floatboatai/open-saas-interview/pulls

**Title:**
```
feat: add HTML animation to video generation
```

**Description:**
```markdown
## What
新增功能：用户输入描述 → AI生成HTML动画 → 自动渲染为MP4视频

## Technical Details
- 前端：React + Wasp operations
- 后端：Wasp actions + PgBoss后台Job
- 渲染：Puppeteer (headless Chrome) + FFmpeg
- 存储：PostgreSQL (Prisma ORM)

## Key Components
1. schema.prisma - Animation数据模型
2. operations.ts - Wasp操作（createAnimation, renderAnimationJob）
3. animationWorker.ts - Puppeteer + FFmpeg渲染
4. AnimationToVideoSection.tsx - 前端UI

## Design Decisions
- Puppeteer vs Canvas：复用CSS动画，零改造
- PgBoss：复用现有PostgreSQL，无需额外依赖
- 状态机：pending → rendering → completed/failed
```

---

祝你面试顺利！🎉
