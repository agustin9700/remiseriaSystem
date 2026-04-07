import { z } from "zod";

export const createFareSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  tarifaBase: z.number().positive("Tarifa base debe ser mayor a 0"),
  valorPorKm: z.number().positive("Valor por km debe ser mayor a 0"),
  valorPorMinuto: z.number().nonnegative(),
  recargoNocturnoPct: z.number().min(0).max(100).optional(),
  recargoLluviaPct: z.number().min(0).max(100).optional(),
});

export const calcularEstimadoSchema = z.object({
  distanciaMetros: z.number().positive("Distancia debe ser mayor a 0"),
  duracionMinutos: z.number().nonnegative(),
  esNocturno: z.boolean().optional().default(false),
});

export type CreateFareInput = z.infer<typeof createFareSchema>;
export type CalcularEstimadoInput = z.infer<typeof calcularEstimadoSchema>;
