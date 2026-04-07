import { FastifyReply, FastifyRequest } from "fastify";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      message: "No autorizado",
    });
  }
}

export function authorize(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { rol?: string };

    if (!user?.rol || !roles.includes(user.rol)) {
      return reply.status(403).send({
        message: "Prohibido",
      });
    }
  };
}