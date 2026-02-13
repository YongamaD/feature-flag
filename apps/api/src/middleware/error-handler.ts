import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: "Validation error",
      details: error.flatten(),
    });
    return;
  }

  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    _request.log.error(error);
  }

  reply.code(statusCode).send({
    error: error.message || "Internal server error",
  });
}
