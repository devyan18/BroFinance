import z from 'zod';

export const signInLocalSchema = {
  body: z.object({
    // Acepta email o nombre de usuario
    identifier: z.string().min(1, 'El correo o nombre de usuario es requerido'),
    password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres'),
  }),
};

export const setPasswordSchema = {
  body: z.object({
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
    password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres'),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  }),
};

export const signUpLocalSchema = {
  body: z.object({
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
    email: z.email('El correo electrónico no es válido'),
    password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres'),
  }),
};

export const googleAuthSchema = {
  body: z
    .object({
      token: z.string().optional(),
      credential: z.string().optional(), // Common in Google Identity Services
      idToken: z.string().optional(), // Common in other libraries
      code: z.string().optional(), // Authorization Code Flow
    })
    .refine(data => data.token || data.credential || data.idToken || data.code, {
      message: 'Google auth requires token, credential, idToken, or code',
      path: ['code'],
    }),
};

const optionalString = () => z.union([z.string(), z.undefined(), z.null()]).optional().transform(v => (v == null || v === '' ? undefined : String(v).trim()));

export const updateProfileSchema = {
  body: z
    .object({
      username: optionalString()
        .refine(v => v === undefined || v.length >= 3, 'El nombre debe tener al menos 3 caracteres'),
      cbu: optionalString().refine(
        v => v === undefined || !v || /^\d{18,26}$/.test(v),
        'CBU/CVU debe tener entre 18 y 26 dígitos',
      ),
      avatarUrl: optionalString().refine(
        v =>
          v === undefined ||
          !v ||
          v.startsWith('http://') ||
          v.startsWith('https://') ||
          /^avatars\/.+\.[a-z]+$/i.test(v),
        'URL o path de avatar inválido',
      ),
      showCbu: z.union([z.boolean(), z.undefined(), z.null()]).optional(),
      showEmail: z.union([z.boolean(), z.undefined(), z.null()]).optional(),
    })
    .partial(),
};

