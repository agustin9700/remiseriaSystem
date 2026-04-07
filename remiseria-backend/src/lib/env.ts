import dotenv from "dotenv";
dotenv.config();

const required = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Variable de entorno requerida no definida: ${key}`);
  }
}

const parseCorsOrigins = () => {
  const raw = process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "";
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (parsed.length > 0) return parsed;

  return ["http://localhost:5173", "https://newremis-1.onrender.com"];
};

export const env = {
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
  DATABASE_URL: process.env.DATABASE_URL as string,
  PORT: Number(process.env.PORT ?? 3000),
  CORS_ORIGINS: parseCorsOrigins(),
  NODE_ENV: process.env.NODE_ENV ?? "development",
  METRICS_TOKEN: process.env.METRICS_TOKEN,
  RATE_LIMIT_AUTH_MAX: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 25),
  RATE_LIMIT_GLOBAL_MAX: Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 2000),
  RATE_LIMIT_PUBLIC_ORDER_MAX: Number(process.env.RATE_LIMIT_PUBLIC_ORDER_MAX ?? 8),
  RATE_LIMIT_TRACK_MAX: Number(process.env.RATE_LIMIT_TRACK_MAX ?? 24),
  RATE_LIMIT_API_MAX: Number(process.env.RATE_LIMIT_API_MAX ?? 180),
};
