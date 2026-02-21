import z from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido');

export const sendRequestSchema = {
  body: z.object({
    userId: objectIdSchema,
  }),
};

export const acceptRejectRequestSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const removeFriendSchema = {
  params: z.object({
    userId: objectIdSchema,
  }),
};

export const searchUsersSchema = {
  query: z.object({
    q: z.string().min(1, 'Búsqueda requerida'),
    limit: z.coerce.number().min(1).max(50).optional().default(20),
  }),
};

export const getStatusSchema = {
  params: z.object({
    userId: objectIdSchema,
  }),
};
