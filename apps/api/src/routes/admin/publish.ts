import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtAuth } from "../../middleware/auth.js";
import * as flagService from "../../services/flag.service.js";
import { invalidateSnapshot } from "../../services/cache.service.js";

const publishBody = z.object({
  environmentId: z.string().uuid(),
});

export default async function publishRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", jwtAuth);

  // Publish flag — creates a new version
  fastify.post<{ Params: { key: string } }>(
    "/v1/admin/flags/:key/publish",
    async (request, reply) => {
      const { key } = request.params;
      const body = publishBody.parse(request.body);

      const result = await flagService.publishFlag(
        fastify.prisma,
        body.environmentId,
        key,
        request.adminUser!.sub
      );

      if (!result) {
        return reply.code(404).send({ error: "Flag not found" });
      }

      // Invalidate Redis cache
      await invalidateSnapshot(fastify.redis, body.environmentId);

      return {
        key,
        version: result.version.version,
        publishedAt: result.version.createdAt,
      };
    }
  );

  // Rollback to a specific version
  fastify.post<{ Params: { key: string; version: string } }>(
    "/v1/admin/flags/:key/rollback/:version",
    async (request, reply) => {
      const { key, version } = request.params;
      const body = publishBody.parse(request.body);
      const targetVersion = parseInt(version, 10);

      if (isNaN(targetVersion) || targetVersion < 1) {
        return reply.code(400).send({ error: "Invalid version number" });
      }

      const result = await flagService.rollbackFlag(
        fastify.prisma,
        body.environmentId,
        key,
        targetVersion,
        request.adminUser!.sub
      );

      if (!result) {
        return reply.code(404).send({ error: "Flag or version not found" });
      }

      // Invalidate Redis cache
      await invalidateSnapshot(fastify.redis, body.environmentId);

      return {
        key,
        rolledBackToVersion: targetVersion,
        newVersion: result.version.version,
        createdAt: result.version.createdAt,
      };
    }
  );
}
