import z from 'zod';

export const signInSchema = {
  body: z.object({
    email: z.email('El correo electrónico no es válido'),
    password: z.string().min(5, 'La contraseña debe tener al menos 8 caracteres'),
  }),
};

export const signUpSchema = {
  body: z.object({
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
    email: z.email('El correo electrónico no es válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  }),
};
