/**
 * Animation Video Renderer Worker
 *
 * Renders HTML animations to video using Puppeteer + FFmpeg
 * This worker is called by the PgBoss background job
 */

import { exec } from "child_process";
import { mkdirSync } from "fs";
import puppeteer from "puppeteer";
import { promisify } from "util";

import type { RenderAnimationJob } from "wasp/server/jobs";

const execAsync = promisify(exec);

type Input = { animationId: string };
type Output = { success: boolean; videoUrl?: string; error?: string };

export const renderAnimationJob: RenderAnimationJob<Input, Output> = async (
  args,
  context,
) => {
  const { animationId } = args;

  console.log(`[AnimationJob] Starting render for animation: ${animationId}`);

  // 1. Fetch animation data
  const animation = await context.entities.Animation.findUnique({
    where: { id: animationId },
  });

  if (!animation) {
    throw new Error(`Animation ${animationId} not found`);
  }

  // 2. Update status to rendering
  await context.entities.Animation.update({
    where: { id: animationId },
    data: { status: "rendering" },
  });

  const tmpDir = `/tmp/animations/${animationId}`;
  const outputPath = `${tmpDir}/output.mp4`;

  try {
    // 3. Launch headless browser
    console.log(`[AnimationJob] Launching Puppeteer...`);
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    // 4. Load HTML content
    console.log(`[AnimationJob] Loading HTML content...`);
    await page.setContent(animation.html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Wait for animation to initialize
    await page.waitForTimeout(1000);

    // 5. Determine animation duration (default 3 seconds)
    const duration = animation.duration || 3;
    const fps = animation.fps || 30;
    const totalFrames = duration * fps;

    console.log(
      `[AnimationJob] Rendering ${totalFrames} frames at ${fps}fps...`,
    );

    // Create temp directory for frames
    mkdirSync(tmpDir, { recursive: true });

    // 6. Render frames
    for (let i = 0; i < totalFrames; i++) {
      const progress = (i / totalFrames) * 100;
      console.log(
        `[AnimationJob] Frame ${i + 1}/${totalFrames} (${progress.toFixed(1)}%)`,
      );

      // Seek to specific time (if animation supports requestAnimationFrame timing)
      // For CSS animations, we use setTimeout to let them progress
      await page.waitForTimeout(1000 / fps);

      // Screenshot frame
      await page.screenshot({
        path: `${tmpDir}/frame_${String(i).padStart(4, "0")}.png`,
        type: "png",
      });
    }

    // 7. Close browser
    await browser.close();
    console.log(`[AnimationJob] Browser closed`);

    // 8. Encode video with FFmpeg
    console.log(`[AnimationJob] Encoding video with FFmpeg...`);

    const ffmpegCommand = [
      "-y", // overwrite output
      "-framerate",
      String(fps),
      "-i",
      `${tmpDir}/frame_%04d.png`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ].join(" ");

    await execAsync(ffmpegCommand);

    console.log(`[AnimationJob] Video encoded: ${outputPath}`);

    // 9. Create thumbnail (first frame)
    const thumbnailPath = `${tmpDir}/thumbnail.jpg`;
    await execAsync(
      `ffmpeg -i "${outputPath}" -ss 00:00:01 -vframes 1 -q:v 2 "${thumbnailPath}"`,
    );

    // 10. Update animation record
    await context.entities.Animation.update({
      where: { id: animationId },
      data: {
        status: "completed",
        videoUrl: outputPath,
        thumbnailUrl: thumbnailPath,
      },
    });

    console.log(`[AnimationJob] Animation completed: ${animationId}`);

    return { success: true, videoUrl: outputPath };
  } catch (error) {
    console.error(`[AnimationJob] Error rendering animation:`, error);

    // Update status to failed
    await context.entities.Animation.update({
      where: { id: animationId },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
