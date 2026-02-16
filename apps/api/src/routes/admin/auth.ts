import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { jwtAuth } from "../../middleware/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "editor"]).default("editor"),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post("/v1/admin/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { sub: user.email, role: user.role },
      process.env.JWT_SECRET || "change-me-in-production",
      { expiresIn: "1h" }
    );

    return { token, expiresIn: 3600 };
  });

  // Register (admin-only)
  fastify.post("/v1/admin/auth/register", { preHandler: jwtAuth }, async (request, reply) => {
    if (request.adminUser?.role !== "admin") {
      return reply.code(403).send({ error: "Admin role required" });
    }

    const body = registerSchema.parse(request.body);

    const existing = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: body.role,
      },
    });

    return reply.code(201).send({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  });
}
