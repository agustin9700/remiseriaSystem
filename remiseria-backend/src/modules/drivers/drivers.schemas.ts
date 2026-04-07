import { z } from "zod";

export const createDriverSchema = z.object({
  userId: z.string().min(1, "userId requerido"),
  vehiculoMarca: z.string().optional(),
  vehiculoModelo: z.string().optional(),
  vehiculoColor: z.string().optional(),
  patente: z.string().optional(),
  licenciaNumero: z.string().optional(),
  licenciaVencimiento: z.string().datetime().optional(),
});

export const updateMyLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
});

export const updateMyStatusSchema = z.object({
  estado: z.enum(["DISPONIBLE", "OFFLINE"]),
});


export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateMyLocationInput = z.infer<typeof updateMyLocationSchema>;
export type UpdateMyStatusInput = z.infer<typeof updateMyStatusSchema>;