# HTML Animation to Video Feature - Interview Submission

## Overview
新增功能：用户输入描述 → AI 生成 HTML 动画 → 自动渲染为 MP4 视频

## Technical Architecture

### Data Model
Added `Animation` model to Prisma schema with fields:
- `prompt`: User's description
- `html`: Generated HTML animation code  
- `status`: State machine (`pending` → `rendering` → `completed` | `failed`)
- `videoUrl`: Path to generated MP4
- `thumbnailUrl`: First frame thumbnail
- `duration`: Animation duration in seconds
- `fps`: Frames per second

### Backend Components

**`operations.ts`** - Wasp operations:
- `createAnimation`: Creates animation record with "pending" status
- `generateAnimationHtml`: Calls OpenAI GPT-4o to generate HTML animation code
- `getAnimationsByUser`: Query user's animations
- `renderAnimationJob`: Background job for video rendering

**Key Fix: Precise Frame Rendering**
- Used `page.evaluate()` + `requestAnimationFrame` instead of `setTimeout`
- Synchronized capture via `postMessage` to avoid timing drift
- CSS animations use rAF internally, so this ensures consistent video speed

**Cross-platform Support**
- Windows: `%TEMP%\animations\{id}`
- Linux/macOS: `/tmp/animations/{id}`
- Configurable via `ANIMATION_TMP_DIR` env var

### Frontend Component

**`AnimationToVideoSection.tsx`**:
- Input field for animation prompt
- Smart polling: only refreshes when animations are "rendering"
- Playback/download buttons for completed videos
- Status indicators with color coding

### Integration
- Added to existing `/demo-app` route (requires authentication)
- Uses existing PgBoss job infrastructure
- Integrates with OpenAI API (credits system)

## Design Decisions

1. **Puppeteer vs Canvas**: Reuse existing CSS/JS animations without modification
2. **PgBoss**: Leverage existing PostgreSQL background jobs, no new dependencies
3. **State Machine**: Prevent race conditions with clear transitions
4. **Precise Timing**: `requestAnimationFrame` synced via `postMessage` ensures frame accuracy

## Files Changed
- `src/demo-ai-app/operations.ts` - Added renderAnimationJob with precise frame capture
- `src/demo-ai-app/animationWorker.ts` - Removed (duplicate definition)
- `src/demo-ai-app/AnimationToVideoSection.tsx` - New frontend component
- `src/demo-ai-app/DemoAppPage.tsx` - Integrated new section
- `src/demo-ai-app/demo-ai-app.wasp.ts` - Registered new job
- `schema.prisma` - Added Animation model

## Testing
```bash
# Install FFmpeg
brew install ffmpeg  # macOS
apt install ffmpeg   # Ubuntu
choco install ffmpeg # Windows

# Start app
wasp start db
wasp start
```
Navigate to `/demo-app` and use "HTML 动画转视频" section.

## Future Enhancements
- S3 integration for video storage
- Progress percentage UI
- Rate limiting per user
- Concurrent render queue with priority
