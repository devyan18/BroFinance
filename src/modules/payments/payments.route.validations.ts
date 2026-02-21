import z from 'zod';

export const transferInfoSchema = {
  body: z.object({
    acreedorId: z.string().min(1, 'El acreedor es requerido'),
    compraIds: z.array(z.string()).optional(),
  }),
};
