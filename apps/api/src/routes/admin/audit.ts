import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jwtAuth } from "../../middleware/auth.js";

const auditQuery = z.object({
  environmentId: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", jwtAuth);

  fastify.get("/v1/admin/audit", async (request) => {
    const query = auditQuery.parse(request.query);
    const skip = (query.page - 1) * query.limit;

    const [logs, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({
        where: { environmentId: query.environmentId },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      fastify.prisma.auditLog.count({
        where: { environmentId: query.environmentId },
      }),
    ]);

    return {
      data: logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });
}
