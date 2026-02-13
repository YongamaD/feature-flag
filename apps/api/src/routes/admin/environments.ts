import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { jwtAuth } from "../../middleware/auth.js";

const createEnvSchema = z.object({
  name: z.string().min(1).max(50),
  projectId: z.string().uuid(),
});

const listEnvQuery = z.object({
  projectId: z.string().uuid(),
});

export default async function environmentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", jwtAuth);

  fastify.post("/v1/admin/environments", async (request, reply) => {
    const body = createEnvSchema.parse(request.body);

    const rawKey = `ff_${randomBytes(24).toString("hex")}`;
    const hash = createHash("sha256").update(rawKey).digest("hex");

    const env = await fastify.prisma.environment.create({
      data: {
        name: body.name,
        projectId: body.projectId,
        apiKeyHash: hash,
      },
    });

    // Return the raw key only once — it cannot be retrieved again
    return reply.code(201).send({
      id: env.id,
      name: env.name,
      apiKey: rawKey,
      createdAt: env.createdAt,
    });
  });

  // List environments for a project
  fastify.get("/v1/admin/environments", async (request) => {
    const query = listEnvQuery.parse(request.query);

    return fastify.prisma.environment.findMany({
      where: { projectId: query.projectId },
      select: {
        id: true,
        name: true,
        projectId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  });
}
