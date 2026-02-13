import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";

export interface AdminUser {
  sub: string;
  role: "admin" | "editor";
}

declare module "fastify" {
  interface FastifyRequest {
    environmentId?: string;
    adminUser?: AdminUser;
  }
}

/**
 * API key auth for SDK-facing endpoints.
 * Hashes the bearer token and looks up the environment.
 */
export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const rawKey = authHeader.slice(7);
  const hash = createHash("sha256").update(rawKey).digest("hex");

  const env = await request.server.prisma.environment.findFirst({
    where: { apiKeyHash: hash },
  });

  if (!env) {
    reply.code(401).send({ error: "Invalid API key" });
    return;
  }

  request.environmentId = env.id;
}

/**
 * JWT auth for admin endpoints.
 */
export async function jwtAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "change-me-in-production"
    ) as AdminUser;
    request.adminUser = payload;
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}
