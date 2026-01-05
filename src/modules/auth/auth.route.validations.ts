import z from 'zod';

export const signInLocalSchema = {
  body: z.object({
    email: z.email('El correo electrónico no es válido'),
    password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres'),
  }),
};

export const signUpLocalSchema = {
  body: z.object({
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
    email: z.email('El correo electrónico no es válido'),
    password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres'),
  }),
};

