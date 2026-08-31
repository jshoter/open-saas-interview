# HTML Animation to Video Feature - Interview Submission

## Overview
新增功能：用户输入描述 → AI 生成 HTML 动画 → 自动渲染为 MP4 视频

**核心技术栈**: Wasp + PgBoss + Puppeteer + FFmpeg + OpenAI GPT-4o

---

## Design Trade-offs (设计取舍)

### 1. Puppeteer vs Canvas API
| 方案 | 优点 | 缺点 |
|------|------|------|
| **Puppeteer** ✅ | 复用现有 CSS/JS 动画，零改造成本 | 需要安装浏览器，内存占用较大 |
| Canvas | 轻量，无需浏览器 | 需要重写动画逻辑 |

**选择原因**: 目标是快速验证概念，Puppeteer 可以渲染任何现有的 CSS 动画而无需修改代码。

### 2. PgBoss vs Bull/Redis
| 方案 | 优点 | 缺点 |
|------|------|------|
| **PgBoss** ✅ | 复用现有 PostgreSQL，无需额外依赖 | 功能相对简单 |
| Bull/Redis | 功能丰富（优先级队列、延迟队列） | 需要额外部署 Redis |

**选择原因**: 项目已有 PostgreSQL，PgBoss 是 Wasp 的默认选择，符合最小依赖原则。

### 3. Frame-based Rendering vs Screen Recording
| 方案 | 优点 | 缺点 |
|------|------|------|
| **Frame-based** ✅ | 确定性输出，相同输入产生相同结果 | 需要等待所有帧渲染完成 |
| Screen recording | 实时输出 | 时间控制不精确 |

**选择原因**: 需要精确控制帧率，确保视频速度与动画时长一致。

### 4. Local Storage vs S3
| 方案 | 优点 | 缺点 |
|------|------|------|
| **Local (Dev)** ✅ | 开发环境简单，无需配置 | 不可扩展，多实例无法共享 |
| S3 (Production) | 可扩展，CDN 加速 | 需要额外配置 |

**选择原因**: 面试任务是 MVP，先跑通核心链路，S3 集成留作后续规划。

---

## Testing Strategy (测试方式)

### 单元测试
```typescript
// 测试 HTML 生成逻辑
describe('generateHtmlAnimation', () => {
  it('should extract HTML from markdown code block', async () => {
    const result = await generateHtmlAnimation('旋转的球体');
    expect(result).toContain('<html>');
    expect(result).toContain('</html>');
  });
});
```

### 集成测试 (Mock Puppeteer)
```typescript
// 测试渲染流程
describe('renderAnimationJob', () => {
  it('should update status to completed after rendering', async () => {
    // Mock puppeteer and ffprobe
    const result = await renderAnimationJob({ animationId }, context);
    expect(result.success).toBe(true);
    expect(animation.status).toBe('completed');
  });
});
```

### 端到端测试
```bash
# 手动测试完整流程
1. 启动应用: wasp start db && wasp start
2. 登录用户账号
3. 访问 /demo-app
4. 输入 prompt: "旋转的彩色球体"
5. 验证:
   - 状态变为 "渲染中..."
   - 等待 10-30 秒
   - 状态变为 "已完成"
   - 可以点击下载视频
```

### 测试覆盖的关键场景
- ✅ 正常流程：创建 → 生成 HTML → 渲染 → 完成
- ✅ 错误处理：GPT API 失败、Puppeteer 崩溃、FFmpeg 错误
- ✅ 状态机：pending → rendering → completed/failed
- ✅ 重试机制：failed 状态可以重新生成

---

## Future Enhancements (后续规划)

### 短期 (1-2 周)
- [ ] **S3 集成**: 视频上传到 S3，返回 CDN 链接
- [ ] **进度条**: 显示渲染进度百分比（当前只显示状态）
- [ ] **Rate Limiting**: 每个用户每小时最多 5 个视频

### 中期 (1 个月)
- [ ] **并发控制**: 全局最多同时渲染 3 个视频
- [ ] **优先级队列**: 付费用户优先渲染
- [ ] **多种格式**: 支持 WebM、GIF 输出
- [ ] **视频编辑**: 裁剪、合并、添加文字

### 长期 (3 个月+)
- [ ] **模板库**: 预设动画效果（粒子、几何、波浪等）
- [ ] **实时预览**: 渲染前先在浏览器预览
- [ ] **API 接口**: 允许外部系统调用生成动画
- [ ] **批量生成**: 一次输入多个 prompt，批量渲染

---

## Files Changed
- `src/demo-ai-app/operations.ts` - Added renderAnimationJob with precise frame capture
- `src/demo-ai-app/animationWorker.ts` - **Removed** (duplicate definition fix)
- `src/demo-ai-app/AnimationToVideoSection.tsx` - New frontend component
- `src/demo-ai-app/DemoAppPage.tsx` - Integrated new section
- `src/demo-ai-app/demo-ai-app.wasp.ts` - Registered new job
- `schema.prisma` - Added Animation model

---

## Key Code Highlights

### Precise Frame Rendering (核心修复)
```typescript
// 使用 page.evaluate() 在浏览器内同步控制 rAF
await page.evaluate(({ totalFrames, frameInterval }) => {
  const captureLoop = (timestamp: number) => {
    const frameIndex = Math.floor((timestamp - startTime) / frameInterval);
    window.postMessage({ type: "CAPTURE_FRAME", frameIndex }, origin);
    if (frameIndex < totalFrames) {
      requestAnimationFrame(captureLoop);
    }
  };
  requestAnimationFrame(captureLoop);
}, { totalFrames, frameInterval });

// Node.js 监听消息并截图
for (let i = 0; i < totalFrames; i++) {
  await waitForMessage("CAPTURE_FRAME", { frameIndex: i });
  await page.screenshot({ path: `frame_${i}.png` });
}
```

**为什么不用 setTimeout？**
- CSS 动画使用 `requestAnimationFrame`，刷新率由浏览器决定（通常 60Hz）
- `setTimeout` 精度受事件循环影响，可能有 ±16ms 偏差
- 累积误差会导致视频速度不准确

---

## Requirements Met
✅ 可解释关键代码、边界处理与设计取舍  
✅ 核心链路已跑通（创建 → 生成 → 渲染 → 下载）  
✅ 状态机防止并发问题  
✅ 错误处理与重试机制  
✅ 跨平台支持 (Windows/Linux/macOS)
