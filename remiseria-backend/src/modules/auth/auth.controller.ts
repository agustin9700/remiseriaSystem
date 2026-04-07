import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authService } from "../../lib/container";
import { handleError } from "../../lib/errors";
import { env } from "../../lib/env";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

const loginSchema = z.object({
  telefono: z.string().trim().min(1, "Teléfono requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken inválido").optional(),
});

function parseCookies(request: FastifyRequest) {
  const raw = request.headers.cookie || "";
  return raw.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...value] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(value.join("="));
    return acc;
  }, {});
}

function getRefreshTokenFromRequest(request: FastifyRequest) {
  const bodyToken = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (bodyToken) return bodyToken;

  const cookies = parseCookies(request);
  return cookies[REFRESH_COOKIE_NAME] || null;
}

function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  const isProduction = env.NODE_ENV === "production";
  const cookieOptions = isProduction
    ? `; Path=/; HttpOnly; Max-Age=${REFRESH_COOKIE_MAX_AGE}; SameSite=None; Secure`
    : `; Path=/; HttpOnly; Max-Age=${REFRESH_COOKIE_MAX_AGE}; SameSite=Lax`;

  reply.header("Set-Cookie", `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}${cookieOptions}`);
}

function clearRefreshCookie(reply: FastifyReply) {
  const isProduction = env.NODE_ENV === "production";
  const cookieOptions = isProduction
    ? `; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`
    : `; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;

  reply.header("Set-Cookie", `${REFRESH_COOKIE_NAME}=;${cookieOptions}`);
}

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });
    }

    try {
      const result = await authService.login(parsed.data.telefono, parsed.data.password);
      setRefreshCookie(reply, result.refreshToken);
      return reply.send({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });
    }

    const refreshToken = parsed.data.refreshToken ?? getRefreshTokenFromRequest(request);
    if (!refreshToken) {
      return reply.status(400).send({ message: "refreshToken requerido" });
    }
    try {
      const result = await authService.refresh(refreshToken);
      setRefreshCookie(reply, result.refreshToken);
      return reply.send({ accessToken: result.accessToken });
    } catch (error) {
      clearRefreshCookie(reply);
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const parsed = refreshSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ message: "Datos inválidos", errors: parsed.error.issues });
    }

    const refreshToken = parsed.data.refreshToken ?? getRefreshTokenFromRequest(request);
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      clearRefreshCookie(reply);
      return reply.send({ message: "Sesión cerrada" });
    } catch (error) {
      clearRefreshCookie(reply);
      const { statusCode, message } = handleError(error);
      return reply.status(statusCode).send({ message });
    }
  }
}
