import type { PrismaPromise } from "@prisma/client";
import OpenAI from "openai";
import type { Animation, GptResponse, Task, User } from "wasp/entities";
import { env, HttpError, prisma } from "wasp/server";
import type { RenderAnimationJob } from "wasp/server/jobs";
import type {
  CreateAnimation,
  CreateTask,
  DeleteTask,
  GenerateAnimationHtml,
  GenerateGptResponse,
  GetAllTasksByUser,
  GetAnimationsByUser,
  GetGptResponses,
  UpdateTask,
} from "wasp/server/operations";
import * as z from "zod";
import { SubscriptionStatus } from "../payment/plans";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { GeneratedSchedule } from "./schedule";

const openAi = new OpenAI({ apiKey: env.OPENAI_API_KEY });

//#region Actions
const generateGptResponseInputSchema = z.object({
  hours: z.number(),
});

type GenerateGptResponseInput = z.infer<typeof generateGptResponseInputSchema>;

export const generateGptResponse: GenerateGptResponse<
  GenerateGptResponseInput,
  GeneratedSchedule
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  const { hours } = ensureArgsSchemaOrThrowHttpError(
    generateGptResponseInputSchema,
    rawArgs,
  );
  const tasks = await context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
  });

  console.log("Calling open AI api");
  const generatedSchedule = await generateScheduleWithGpt(tasks, hours);
  if (generatedSchedule === null) {
    throw new HttpError(
      500,
      "Encountered a problem in communication with OpenAI",
    );
  }

  const createResponse = context.entities.GptResponse.create({
    data: {
      user: { connect: { id: context.user.id } },
      content: JSON.stringify(generatedSchedule),
    },
  });

  const transactions: PrismaPromise<GptResponse | User>[] = [createResponse];

  // We decrement the credits for users without an active subscription
  // after using up tokens to get a daily plan from Chat GPT.
  //
  // This way, users don't feel cheated if something goes wrong.
  // On the flipside, users can theoretically abuse this and spend more
  // credits than they have, but the damage should be pretty limited.
  //
  // Think about which option you prefer for your app and edit the code accordingly.
  if (!isUserSubscribed(context.user)) {
    if (context.user.credits > 0) {
      const decrementCredit = context.entities.User.update({
        where: { id: context.user.id },
        data: {
          credits: {
            decrement: 1,
          },
        },
      });
      transactions.push(decrementCredit);
    } else {
      throw new HttpError(
        402,
        "User has no subscription and is out of credits",
      );
    }
  }

  console.log("Decrementing credits and saving response");
  await prisma.$transaction(transactions);

  return generatedSchedule;
};

function isUserSubscribed(user: User) {
  return (
    user.subscriptionStatus === SubscriptionStatus.Active ||
    user.subscriptionStatus === SubscriptionStatus.CancelAtPeriodEnd
  );
}

const createTaskInputSchema = z.object({
  description: z.string().nonempty(),
});

type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const createTask: CreateTask<CreateTaskInput, Task> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { description } = ensureArgsSchemaOrThrowHttpError(
    createTaskInputSchema,
    rawArgs,
  );

  const task = await context.entities.Task.create({
    data: {
      description,
      user: { connect: { id: context.user.id } },
    },
  });

  return task;
};

const updateTaskInputSchema = z.object({
  id: z.string().nonempty(),
  isDone: z.boolean().optional(),
  time: z.string().optional(),
});

type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const updateTask: UpdateTask<UpdateTaskInput, Task> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { id, isDone, time } = ensureArgsSchemaOrThrowHttpError(
    updateTaskInputSchema,
    rawArgs,
  );

  const task = await context.entities.Task.update({
    where: {
      id,
      user: {
        id: context.user.id,
      },
    },
    data: {
      isDone,
      time,
    },
  });

  return task;
};

const deleteTaskInputSchema = z.object({
  id: z.string().nonempty(),
});

type DeleteTaskInput = z.infer<typeof deleteTaskInputSchema>;

export const deleteTask: DeleteTask<DeleteTaskInput, Task> = async (
  rawArgs,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    deleteTaskInputSchema,
    rawArgs,
  );

  const task = await context.entities.Task.delete({
    where: {
      id,
      user: {
        id: context.user.id,
      },
    },
  });

  return task;
};
//#endregion

//#region Queries
export const getGptResponses: GetGptResponses<void, GptResponse[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.GptResponse.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
  });
};

export const getAllTasksByUser: GetAllTasksByUser<void, Task[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};
//#endregion

//#region Animation to Video Feature
// Schema for creating animation
const createAnimationInputSchema = z.object({
  prompt: z.string().min(1).max(500),
});

type CreateAnimationInput = z.infer<typeof createAnimationInputSchema>;

export const createAnimation: CreateAnimation<
  CreateAnimationInput,
  Animation
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { prompt } = ensureArgsSchemaOrThrowHttpError(
    createAnimationInputSchema,
    rawArgs,
  );

  // Create animation record with pending status
  const animation = await context.entities.Animation.create({
    data: {
      user: { connect: { id: context.user.id } },
      prompt,
      html: "", // Will be filled by generateAnimationHtml
      status: "pending",
    },
  });

  return animation;
};

// Schema for generating animation HTML via GPT
const generateAnimationHtmlInputSchema = z.object({
  animationId: z.string().min(1),
});

type GenerateAnimationHtmlInput = z.infer<
  typeof generateAnimationHtmlInputSchema
>;

export const generateAnimationHtml: GenerateAnimationHtml<
  GenerateAnimationHtmlInput,
  Animation
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { animationId } = ensureArgsSchemaOrThrowHttpError(
    generateAnimationHtmlInputSchema,
    rawArgs,
  );

  // Fetch animation record
  const animation = await context.entities.Animation.findUnique({
    where: { id: animationId },
  });

  if (!animation) {
    throw new HttpError(404, "Animation not found");
  }

  if (animation.userId !== context.user.id) {
    throw new HttpError(403, "Unauthorized");
  }

  // Generate HTML animation using GPT
  const html = await generateHtmlAnimation(animation.prompt);

  // Update animation with generated HTML
  const updated = await context.entities.Animation.update({
    where: { id: animationId },
    data: { html },
  });

  return updated;
};

// Schema for querying animations
const getAnimationsByUserQuerySchema = z.object({});

type GetAnimationsByUserQuery = z.infer<typeof getAnimationsByUserQuerySchema>;

export const getAnimationsByUser: GetAnimationsByUser<
  GetAnimationsByUserQuery,
  Animation[]
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  return context.entities.Animation.findMany({
    where: {
      userId: context.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// Background job for rendering video
export const renderAnimationJob: RenderAnimationJob<
  { animationId: string },
  { success: boolean; videoUrl?: string; error?: string }
> = async (args, context) => {
  const { animationId } = args;

  console.log(`[AnimationJob] Starting render for: ${animationId}`);

  // Fetch animation
  const animation = await context.entities.Animation.findUnique({
    where: { id: animationId },
  });

  if (!animation) {
    throw new Error(`Animation ${animationId} not found`);
  }

  // Update status to rendering
  await context.entities.Animation.update({
    where: { id: animationId },
    data: { status: "rendering" },
  });

  // 跨平台临时目录处理：Windows 使用 %TEMP% 或 C:\Temp，Unix 使用 /tmp
  const baseTmpDir =
    process.env.ANIMATION_TMP_DIR ||
    (process.platform === "win32"
      ? `${process.env.TEMP || "C:\\Temp"}\\animations`
      : "/tmp/animations");
  const tmpDir = `${baseTmpDir}/${animationId}`;
  const outputPath = `${tmpDir}/output.mp4`;

  try {
    // Import puppeteer dynamically to avoid issues
    const puppeteer = await import("puppeteer");
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const { mkdirSync } = await import("fs");
    const execAsync = promisify(exec);

    // Launch browser
    const browser = await puppeteer.default.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    // Load HTML
    await page.setContent(animation.html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // Render frames with precise timing using requestAnimationFrame
    // 为什么不用 setTimeout/waitForTimeout？
    // - CSS 动画使用 requestAnimationFrame，刷新率由浏览器决定（通常 60Hz）
    // - setTimeout 精度受事件循环影响，可能有几毫秒到几十毫秒的偏差
    // - 累积误差会导致视频速度不准确
    //
    // 解决方案：使用 page.evaluate() 在浏览器内同步控制 rAF，通过 postMessage 传回帧索引
    const duration = animation.duration || 3;
    const fps = animation.fps || 30;
    const totalFrames = duration * fps;
    const frameInterval = 1000 / fps; // 每帧间隔（毫秒）

    console.log(
      `[AnimationJob] Rendering ${totalFrames} frames at ${fps}fps, ${duration}s duration`,
    );

    mkdirSync(tmpDir, { recursive: true });

    // 在页面中启动动画并设置帧捕获控制器
    await page.evaluate(
      ({ totalFrames, frameInterval }) => {
        const state = {
          startTime: performance.now(),
          rafId: null as number | null,
          capturedFrames: 0,
        };

        // 定义帧捕获回调，通过 postMessage 传回 Node.js
        (window as any).__captureFrame = (frameIndex: number) => {
          window.postMessage(
            { type: "CAPTURE_FRAME", frameIndex },
            window.location.origin,
          );
        };

        // 使用 requestAnimationFrame 精确控制拍摄时机
        const captureLoop = (timestamp: number) => {
          const elapsed = timestamp - state.startTime;
          const frameIndex = Math.floor(elapsed / frameInterval);

          if (frameIndex < totalFrames) {
            state.capturedFrames = frameIndex + 1;
            (window as any).__captureFrame(frameIndex);
            state.rafId = requestAnimationFrame(captureLoop);
          }
        };

        state.rafId = requestAnimationFrame(captureLoop);

        // 暴露清理函数供后续使用
        (window as any).__cancelAnimation = () => {
          if (state.rafId) cancelAnimationFrame(state.rafId);
        };
      },
      { totalFrames, frameInterval },
    );

    // 监听页面消息，当收到 CAPTURE_FRAME 时截图
    const framePromises: Promise<void>[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const promise = new Promise<void>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (
            event.data?.type === "CAPTURE_FRAME" &&
            event.data.frameIndex === i
          ) {
            page.removeListener("message", handler);
            resolve();
          }
        };
        page.on("message", handler);
      });
      framePromises.push(promise);
    }

    // 并行执行截图和动画运行
    const screenshotTask = async () => {
      for (let i = 0; i < totalFrames; i++) {
        // 等待对应帧的捕获信号
        await framePromises[i];

        const progress = ((i + 1) / totalFrames) * 100;
        console.log(
          `[AnimationJob] Frame ${i + 1}/${totalFrames} (${progress.toFixed(1)}%)`,
        );

        await page.screenshot({
          path: `${tmpDir}/frame_${String(i).padStart(4, "0")}.png`,
          type: "png",
        });
      }
    };

    await Promise.all([screenshotTask()]);

    await browser.close();

    // Encode video
    console.log("[AnimationJob] Encoding video...");
    await execAsync(
      `ffmpeg -y -framerate ${fps} -i "${tmpDir}/frame_%04d.png" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart "${outputPath}"`,
    );

    // Create thumbnail
    const thumbnailPath = `${tmpDir}/thumbnail.jpg`;
    await execAsync(
      `ffmpeg -i "${outputPath}" -ss 00:00:01 -vframes 1 -q:v 2 "${thumbnailPath}"`,
    );

    // Update animation
    await context.entities.Animation.update({
      where: { id: animationId },
      data: {
        status: "completed",
        videoUrl: outputPath,
        thumbnailUrl: thumbnailPath,
      },
    });

    console.log(`[AnimationJob] Completed: ${animationId}`);
    return { success: true, videoUrl: outputPath };
  } catch (error) {
    console.error("[AnimationJob] Error:", error);
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

// Helper function to generate HTML animation using GPT
async function generateHtmlAnimation(prompt: string): Promise<string> {
  const completion = await openAi.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert HTML/CSS/JavaScript animator. Create a single, self-contained HTML file that renders a beautiful animation based on the user's prompt.

Requirements:
1. Use only HTML, CSS, and vanilla JavaScript (no external libraries)
2. The animation should be visually appealing and smooth
3. Include proper styling with CSS animations or requestAnimationFrame
4. Make it responsive and centered on the page
5. Use a nice color scheme
6. Keep the code clean and well-commented
7. Return ONLY the complete HTML code, wrapped in a markdown code block with "html" language tag`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content || "";

  // Extract HTML from markdown code block if present
  const match = content.match(/```html\n([\s\S]*?)\n```/);
  if (match) {
    return match[1].trim();
  }

  // Otherwise return as-is
  return content.trim();
}
//#endregion
