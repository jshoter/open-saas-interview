# HTML Animation to Video Feature

## Overview

This PR adds a new feature to convert AI-generated HTML animations into video files (MP4). Users can describe an animation in natural language, and the system will:

1. Generate HTML/CSS/JS animation code using OpenAI GPT-4o
2. Save the animation record to the database
3. Render frames using Puppeteer (headless Chrome)
4. Encode frames into MP4 video using FFmpeg
5. Provide playback/download capability

## Technical Architecture

### Data Model

Added `Animation` model to Prisma schema:
- `prompt`: User's description
- `html`: Generated HTML animation code
- `status`: State machine (`pending` → `rendering` → `completed` | `failed`)
- `videoUrl`: Path to generated MP4
- `thumbnailUrl`: First frame thumbnail
- `duration`: Animation duration in seconds
- `fps`: Frames per second

### Backend Components

**`operations.ts`** - New Wasp operations:
- `createAnimation`: Creates animation record with "pending" status
- `generateAnimationHtml`: Calls OpenAI GPT-4o to generate HTML animation code
- `getAnimationsByUser`: Query user's animations
- `renderAnimationJob`: Background job for video rendering

**`animationWorker.ts`** - Puppeteer + FFmpeg worker:
- Uses Puppeteer to render HTML in headless Chrome
- Captures frames at specified FPS
- Uses FFmpeg to encode frames to MP4
- Handles errors gracefully with state updates

### Frontend Component

**`AnimationToVideoSection.tsx`**:
- Input field for animation prompt
- Progress display for each animation
- Playback buttons for completed videos
- Auto-refresh for pending/rendering states

### Integration

- Added to existing `/demo-app` route
- Requires authentication
- Integrates with existing credits system (uses OpenAI API)

## Design Decisions

### 1. Background Job Pattern
Following the existing Wasp job pattern (same as `analytics/stats.ts`), using PgBoss for reliable async processing.

### 2. Frame-Based Rendering
Using Puppeteer screenshot approach (similar to [HyperFrames](https://github.com/silenceper/hyperframes)) because:
- Works with any CSS/JS animation without modification
- Deterministic output for same input
- No need to rewrite animations for video export

### 3. Local Storage (Dev) / S3 (Production)
Video files stored in `/tmp/animations/` during development. For production, would integrate with existing S3 file upload infrastructure.

### 4. State Machine
Clear status transitions prevent race conditions:
- `pending`: Created, waiting for HTML generation
- `rendering`: HTML generated, video being rendered
- `completed`: Video ready for playback
- `failed`: Error occurred, can retry

## Dependencies Added

```json
{
  "puppeteer": "^21.x"
}
```

## Required Environment Variables

```env
OPENAI_API_KEY=sk-...  # For HTML generation
```

## Testing

To test locally:
```bash
# Ensure FFmpeg is installed
brew install ffmpeg  # macOS
apt install ffmpeg   # Ubuntu

# Install dependencies
npm install puppeteer

# Start Wasp
wasp start db
wasp start
```

Then navigate to `/demo-app` and use the new "HTML 动画转视频" section.

## Files Changed

1. `schema.prisma` - Added Animation model
2. `src/demo-ai-app/operations.ts` - New operations
3. `src/demo-ai-app/animationWorker.ts` - Video rendering worker
4. `src/demo-ai-app/DemoAppPage.tsx` - Added AnimationToVideoSection
5. `src/demo-ai-app/AnimationToVideoSection.tsx` - New frontend component
6. `src/demo-ai-app/demo-ai-app.wasp.ts` - Registered new job

## Future Enhancements

- [ ] S3 integration for video storage
- [ ] Progress percentage in UI
- [ ] Video editing/trimming
- [ ] Multiple resolution support
- [ ] Animation template library
