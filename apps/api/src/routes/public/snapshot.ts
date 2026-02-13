import type { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../../middleware/auth.js";
import * as flagService from "../../services/flag.service.js";
import {
  getCachedSnapshot,
  setCachedSnapshot,
} from "../../services/cache.service.js";

export default async function snapshotRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", apiKeyAuth);

  fastify.get("/v1/flags/snapshot", async (request, reply) => {
    const envId = request.environmentId!;

    // Check Redis cache first
    const cached = await getCachedSnapshot(fastify.redis, envId);
    if (cached) {
      const etag = `"v${cached.version}"`;

      // Check If-None-Match
      const ifNoneMatch = request.headers["if-none-match"];
      if (ifNoneMatch === etag) {
        return reply.code(304).send();
      }

      reply.header("etag", etag);
      reply.header("x-cache", "HIT");
      return cached;
    }

    // Fallback to Postgres
    const snapshot = await flagService.buildSnapshot(fastify.prisma, envId);

    // Cache in Redis
    await setCachedSnapshot(fastify.redis, envId, snapshot);

    const etag = `"v${snapshot.version}"`;
    reply.header("etag", etag);
    reply.header("x-cache", "MISS");
    return snapshot;
  });
}
