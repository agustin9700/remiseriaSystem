import { prisma } from "../../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../lib/env";
import { UnauthorizedError } from "../../lib/errors";
import crypto from "crypto";

const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

export class AuthService {
  async login(telefono: string, password: string) {
    const user = await prisma.user.findUnique({ where: { telefono } });

    // FIX: mismo mensaje para usuario inexistente y contraseña incorrecta
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !passwordMatch) {
      throw new UnauthorizedError("Credenciales inválidas");
    }

    if (!user.activo) {
      throw new UnauthorizedError("Usuario inactivo");
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        telefono: user.telefono,
        email: user.email,
        rol: user.rol,
        activo: user.activo,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async refresh(refreshToken: string) {
    // Primero verificar la firma JWT — si falló no tiene sentido buscar en DB
    try {
      jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new UnauthorizedError("Refresh token inválido o expirado");
    }

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedError("Refresh token inválido o expirado");
    }

    // Rotar: revocar el anterior y emitir uno nuevo
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newAccessToken = this.generateAccessToken(stored.user);
    const newRefreshToken = await this.generateRefreshToken(stored.user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private generateAccessToken(user: { id: string; nombre: string; apellido: string; telefono: string; rol: string }) {
    return jwt.sign(
      { userId: user.id, nombre: user.nombre, apellido: user.apellido, telefono: user.telefono, rol: user.rol },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
  }

  private async generateRefreshToken(userId: string) {
    // Usamos JWT_REFRESH_SECRET distinto del access token para que un secret comprometido
    // no afecte al otro tipo de token.
    const token = jwt.sign({ userId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
      expiresIn: `${REFRESH_TOKEN_EXPIRES_DAYS}d`,
    });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }
}
