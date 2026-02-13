import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { loadConfig } from "./config.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import { errorHandler } from "./middleware/error-handler.js";

// Admin routes
import authRoutes from "./routes/admin/auth.js";
import environmentRoutes from "./routes/admin/environments.js";
import flagRoutes from "./routes/admin/flags.js";
import publishRoutes from "./routes/admin/publish.js";
import auditRoutes from "./routes/admin/audit.js";

// Public routes
import snapshotRoutes from "./routes/public/snapshot.js";
import evaluateRoutes from "./routes/public/evaluate.js";

export async function buildApp() {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Plugins
  await app.register(cors);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 second",
    keyGenerator: (request) => {
      // Rate limit by API key or IP
      return request.headers.authorization || request.ip;
    },
  });
  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Register routes
  await app.register(authRoutes);
  await app.register(environmentRoutes);
  await app.register(flagRoutes);
  await app.register(publishRoutes);
  await app.register(auditRoutes);
  await app.register(snapshotRoutes);
  await app.register(evaluateRoutes);

  return { app, config };
}

// Start server when run directly
async function start() {
  const { app, config } = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`Server running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
