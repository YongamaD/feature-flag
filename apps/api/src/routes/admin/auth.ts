import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Simplified admin auth for MVP — in production, use a proper user table + bcrypt
const ADMIN_USERS: Record<string, { password: string; role: "admin" | "editor" }> = {
  "admin@example.com": { password: "admin123", role: "admin" },
};

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/v1/admin/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = ADMIN_USERS[body.email];
    if (!user || user.password !== body.password) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { sub: body.email, role: user.role },
      process.env.JWT_SECRET || "change-me-in-production",
      { expiresIn: "1h" }
    );

    return { token, expiresIn: 3600 };
  });
}
