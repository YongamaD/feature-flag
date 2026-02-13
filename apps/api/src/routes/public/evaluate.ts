import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { evaluate, type FlagState } from "@feature-flags/evaluator";
import { apiKeyAuth } from "../../middleware/auth.js";
import { getCachedSnapshot } from "../../services/cache.service.js";
import * as flagService from "../../services/flag.service.js";

const evaluateBody = z.object({
  flagKey: z.string().min(1),
  context: z.record(z.unknown()),
});

export default async function evaluateRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", apiKeyAuth);

  fastify.post("/v1/evaluate", async (request, reply) => {
    const body = evaluateBody.parse(request.body);
    const envId = request.environmentId!;

    // Try Redis snapshot first
    let flagState: FlagState | null = null;
    let flagVersion: number | undefined;

    const cached = await getCachedSnapshot(fastify.redis, envId);
    if (cached && cached.flags[body.flagKey]) {
      flagState = cached.flags[body.flagKey] as FlagState;
      flagVersion = cached.version;
    }

    // Fallback to DB
    if (!flagState) {
      const flag = await flagService.getFlag(
        fastify.prisma,
        envId,
        body.flagKey
      );
      if (!flag || flag.versions.length === 0) {
        return reply.code(404).send({ error: "Flag not found" });
      }
      flagState = flag.versions[0].stateJson as unknown as FlagState;
      flagVersion = flag.versions[0].version;
    }

    const result = evaluate(flagState, body.flagKey, body.context);

    return {
      ...result,
      flagVersion,
    };
  });
}
