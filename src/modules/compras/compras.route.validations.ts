import z from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido');

export const createCompraSchema = {
  body: z
    .object({
      descripcion: z.string().min(1, 'La descripción es requerida').max(200),
      montoTotal: z.number().positive('El monto total debe ser positivo'),
      montoDeudor: z.number().positive('Lo que debe el deudor debe ser positivo'),
      tipo: objectIdSchema,
      deudorId: objectIdSchema.optional(), // Opcional: gasto personal (solo)
    })
    .refine((data) => data.montoDeudor <= data.montoTotal, {
      message: 'Lo que debe el deudor no puede superar el monto total',
      path: ['montoDeudor'],
    }),
};

export const updateCompraSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      descripcion: z.string().min(1).max(200).optional(),
      montoTotal: z.number().positive().optional(),
      montoDeudor: z.number().positive().optional(),
      tipo: objectIdSchema.optional(),
    })
    .refine(
      (data) => {
        if (data.montoDeudor != null && data.montoTotal != null) {
          return data.montoDeudor <= data.montoTotal;
        }
        return true;
      },
      { message: 'Lo que debe el deudor no puede superar el monto total', path: ['montoDeudor'] },
    ),
};

export const getByIdSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const getBalanceSchema = {
  params: z.object({
    roommateId: objectIdSchema,
  }),
};

export const createCompraBatchSchema = {
  body: z
    .object({
      descripcion: z.string().min(1, 'La descripción es requerida').max(200),
      montoTotal: z.number().positive('El monto total debe ser positivo'),
      tipo: objectIdSchema,
      deudores: z
        .array(
          z.object({
            deudorId: objectIdSchema,
            montoDeudor: z.number().positive('El monto del deudor debe ser positivo'),
          }),
        )
        .min(1, 'Debes seleccionar al menos un deudor'),
    })
    .refine(
      (data) => data.deudores.every((d) => d.montoDeudor <= data.montoTotal),
      { message: 'El monto de algún deudor supera el monto total', path: ['deudores'] },
    ),
};
