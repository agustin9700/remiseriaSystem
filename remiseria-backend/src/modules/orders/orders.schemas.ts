import { EstadoPedido } from "@prisma/client";
import { z } from "zod";

const optionalDateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Fecha inválida");

const positiveIntegerFromQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  return Number(value);
}, z.number().int().positive());

export const createOrderSchema = z.object({
  nombreCliente: z.string().min(1, "Nombre del cliente requerido"),
  telefonoCliente: z.string().min(1, "Teléfono del cliente requerido"),
  origenTexto: z.string().min(1, "Origen requerido"),
  origenLat: z.number().nullable().optional(),
  origenLng: z.number().nullable().optional(),
  destinoTexto: z.string().optional(),
  destinoLat: z.number().nullable().optional(),
  destinoLng: z.number().nullable().optional(),
  observaciones: z.string().optional(),
});

export const createPublicOrderSchema = z.object({
  nombreCliente: z.string().min(1),
  telefonoCliente: z.string().min(1).optional().default("Sin teléfono"),
  origenTexto: z.string().min(3),
  origenLat: z.number(),
  origenLng: z.number(),
  destinoTexto: z.string().min(3),
  destinoLat: z.number(),
  destinoLng: z.number(),
  observaciones: z.string().optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1, "driverId requerido"),
});

export const acceptOrderSchema = z.object({});

export const rejectOrderSchema = z.object({
  motivoRechazo: z.string().min(1, "Motivo de rechazo requerido"),
});

export const onTheWayOrderSchema = z.object({});

export const startOrderSchema = z.object({});

export const finishOrderSchema = z.object({
  montoFinal: z.number().positive("montoFinal debe ser mayor a 0"),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA"]),
});

export const cancelOrderSchema = z.object({
  motivoCancelacion: z.string().min(1, "Motivo de cancelación requerido"),
});

export const rejectByOperatorSchema = z.object({
  motivoRechazo: z.string().min(1, "Motivo de rechazo requerido"),
});

export const finishByOperatorSchema = z.object({
  montoFinal: z.number().positive(),
  metodoPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "TARJETA"]),
  nota: z.string().optional(),
});

export const unassignDriverSchema = z.object({
  motivo: z.string().optional(),
});

export const listOrdersQuerySchema = z.object({
  page: positiveIntegerFromQuery.optional(),
  limit: positiveIntegerFromQuery.optional(),
  estado: z.nativeEnum(EstadoPedido).optional(),
});

export const statsDateRangeQuerySchema = z
  .object({
    desde: optionalDateString.optional(),
    hasta: optionalDateString.optional(),
  })
  .refine(
    (value) => {
      if (!value.desde || !value.hasta) return true;
      return new Date(value.desde) <= new Date(value.hasta);
    },
    {
      message: "'desde' no puede ser mayor que 'hasta'",
      path: ["hasta"],
    },
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
export type AcceptOrderInput = z.infer<typeof acceptOrderSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
export type OnTheWayOrderInput = z.infer<typeof onTheWayOrderSchema>;
export type StartOrderInput = z.infer<typeof startOrderSchema>;
export type FinishOrderInput = z.infer<typeof finishOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type RejectByOperatorInput = z.infer<typeof rejectByOperatorSchema>;
export type FinishByOperatorInput = z.infer<typeof finishByOperatorSchema>;
export type UnassignDriverInput = z.infer<typeof unassignDriverSchema>;
export type CreatePublicOrderInput = z.infer<typeof createPublicOrderSchema>;
export type ListOrdersQueryInput = z.infer<typeof listOrdersQuerySchema>;
export type StatsDateRangeQueryInput = z.infer<typeof statsDateRangeQuerySchema>;
