import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtAuth } from "../../middleware/auth.js";
import * as flagService from "../../services/flag.service.js";

const flagStateSchema = z.object({
  enabled: z.boolean(),
  defaultVariant: z.string(),
  variants: z.array(z.string()).min(1),
  rules: z.array(
    z.object({
      id: z.string(),
      conditions: z.array(
        z.object({
          attr: z.string(),
          op: z.enum(["EQ", "NEQ", "IN", "NOT_IN", "GT", "LT", "CONTAINS"]),
          value: z.unknown(),
        })
      ),
      result: z.object({
        enabled: z.boolean(),
        variant: z.string(),
      }),
    })
  ),
  rollout: z
    .object({
      type: z.literal("PERCENT"),
      percentage: z.number().min(0).max(100),
      stickinessKey: z.string(),
    })
    .nullable(),
});

const createFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Flag key must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  environmentId: z.string().uuid(),
  initialState: flagStateSchema,
});

const updateFlagSchema = z.object({
  environmentId: z.string().uuid(),
  stateJson: flagStateSchema,
});

const listFlagsQuery = z.object({
  environmentId: z.string().uuid(),
});

const archiveBody = z.object({
  environmentId: z.string().uuid(),
});

export default async function flagRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", jwtAuth);

  // Create flag
  fastify.post("/v1/admin/flags", async (request, reply) => {
    const body = createFlagSchema.parse(request.body);

    const flag = await flagService.createFlag(fastify.prisma, {
      key: body.key,
      description: body.description,
      environmentId: body.environmentId,
      initialState: body.initialState,
      createdBy: request.adminUser!.sub,
    });

    return reply.code(201).send(flag);
  });

  // List flags
  fastify.get("/v1/admin/flags", async (request) => {
    const query = listFlagsQuery.parse(request.query);
    return flagService.listFlags(fastify.prisma, query.environmentId);
  });

  // Get flag with versions
  fastify.get<{ Params: { key: string }; Querystring: { environmentId: string } }>(
    "/v1/admin/flags/:key",
    async (request, reply) => {
      const { key } = request.params;
      const { environmentId } = z
        .object({ environmentId: z.string().uuid() })
        .parse(request.query);

      const flag = await flagService.getFlag(fastify.prisma, environmentId, key);
      if (!flag) {
        return reply.code(404).send({ error: "Flag not found" });
      }
      return flag;
    }
  );

  // Update draft state
  fastify.put<{ Params: { key: string } }>(
    "/v1/admin/flags/:key",
    async (request, reply) => {
      const { key } = request.params;
      const body = updateFlagSchema.parse(request.body);

      const updated = await flagService.updateDraftState(
        fastify.prisma,
        body.environmentId,
        key,
        body.stateJson,
        request.adminUser!.sub
      );

      if (!updated) {
        return reply.code(404).send({ error: "Flag not found" });
      }

      return updated;
    }
  );

  // Archive flag
  fastify.patch<{ Params: { key: string } }>(
    "/v1/admin/flags/:key/archive",
    async (request, reply) => {
      const { key } = request.params;
      const body = archiveBody.parse(request.body);

      const flag = await flagService.archiveFlag(
        fastify.prisma,
        body.environmentId,
        key,
        request.adminUser!.sub
      );

      if (!flag) {
        return reply.code(404).send({ error: "Flag not found" });
      }

      return flag;
    }
  );

  // Unarchive flag
  fastify.patch<{ Params: { key: string } }>(
    "/v1/admin/flags/:key/unarchive",
    async (request, reply) => {
      const { key } = request.params;
      const body = archiveBody.parse(request.body);

      const flag = await flagService.unarchiveFlag(
        fastify.prisma,
        body.environmentId,
        key,
        request.adminUser!.sub
      );

      if (!flag) {
        return reply.code(404).send({ error: "Flag not found" });
      }

      return flag;
    }
  );
}
