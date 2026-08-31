import { action, job, page, query, route, type Spec } from "@wasp.sh/spec";

import { DemoAppPage } from "./DemoAppPage" with { type: "ref" };
import {
  createAnimation,
  createTask,
  deleteTask,
  generateAnimationHtml,
  generateGptResponse,
  getAllTasksByUser,
  getAnimationsByUser,
  getGptResponses,
  renderAnimationJob,
  updateTask,
} from "./operations" with { type: "ref" };

export const demoAiAppSpec: Spec = [
  route("DemoAppRoute", "/demo-app", page(DemoAppPage, { authRequired: true })),

  // Existing GPT features
  query(getGptResponses, { entities: ["User", "GptResponse"] }),
  action(generateGptResponse, { entities: ["User", "Task", "GptResponse"] }),

  query(getAllTasksByUser, { entities: ["Task"] }),
  action(createTask, { entities: ["Task"] }),
  action(updateTask, { entities: ["Task"] }),
  action(deleteTask, { entities: ["Task"] }),

  // New Animation to Video features
  query(getAnimationsByUser, { entities: ["Animation"] }),
  action(createAnimation, { entities: ["Animation"] }),
  action(generateAnimationHtml, { entities: ["Animation"] }),

  // Background job for video rendering
  job(renderAnimationJob, {
    executor: "PgBoss",
    entities: ["User", "Animation"],
  }),
];
