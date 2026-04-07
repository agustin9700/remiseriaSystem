import pino from "pino";
import { randomBytes } from "crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    bindings: () => ({}),
  },
  timestamp: () => `"timestamp":"${new Date().toISOString()}"`,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export function generateRequestId(): string {
  return randomBytes(8).toString("hex");
}

interface LogContext {
  requestId?: string;
  userId?: string;
  role?: string;
  orderId?: string;
  driverId?: string;
  fromEstado?: string;
  toEstado?: string;
  durationMs?: number;
  success?: boolean;
  error?: Error;
}

export function logOrderAction(
  action: string,
  context: LogContext
): void {
  const {
    requestId,
    userId,
    role,
    orderId,
    driverId,
    fromEstado,
    toEstado,
    durationMs,
    success,
    error,
  } = context;

  const logData: Record<string, unknown> = {
    requestId,
    level: error ? "error" : "info",
    message: `Order action: ${action}`,
    action,
  };
  
  if (userId) logData.userId = userId;
  if (role) logData.role = role;
  if (orderId) logData.orderId = orderId;
  if (driverId) logData.driverId = driverId;
  if (fromEstado) logData.fromEstado = fromEstado;
  if (toEstado) logData.toEstado = toEstado;
  if (durationMs !== undefined) logData.durationMs = durationMs;
  if (success !== undefined) logData.success = success;
  if (error) logData.error = error.message || error;

  if (error) {
    logger.error(logData);
  } else {
    logger.info(logData);
  }
}

interface ApiContext {
  requestId?: string;
  userId?: string;
  role?: string;
  durationMs?: number;
  statusCode?: number;
}

export function logApiRequest(
  method: string,
  url: string,
  context: ApiContext
): void {
  const { requestId, userId, role, durationMs, statusCode } = context;

  logger.info({
    requestId,
    level: "info",
    message: `API request: ${method} ${url}`,
    method,
    url,
    userId,
    role,
    durationMs,
    statusCode,
  });
}

interface ConflictContext {
  requestId?: string;
  userId?: string;
  orderId?: string;
  driverId?: string;
  fromEstado?: string;
  toEstado?: string;
  reason?: string;
}

export function logConflict(
  action: string,
  context: ConflictContext
): void {
  const { requestId, userId, orderId, driverId, fromEstado, toEstado, reason } = context;

  const logData: Record<string, unknown> = {
    requestId,
    level: "warn",
    message: `Conflict: ${action}`,
    action,
  };
  
  if (userId) logData.userId = userId;
  if (orderId) logData.orderId = orderId;
  if (driverId) logData.driverId = driverId;
  if (fromEstado) logData.fromEstado = fromEstado;
  if (toEstado) logData.toEstado = toEstado;
  if (reason) logData.reason = reason;

  logger.warn(logData);
}