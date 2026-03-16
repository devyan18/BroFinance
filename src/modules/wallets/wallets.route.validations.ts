import z from 'zod';
import { getWalletProviderIds } from './wallet-providers.const.ts';

const providerKeys = getWalletProviderIds();
const mongoId = z.string().regex(/^[a-f0-9]{24}$/i, 'ID inválido');

export const addWalletSchema = {
  body: z.object({
    providerKey: z.enum(providerKeys as [string, ...string[]], {
      errorMap: () => ({ message: 'Proveedor de billetera no válido' }),
    }),
    cbu: z.string().trim().refine((v) => /^\d{18,26}$/.test(v), 'CBU/CVU debe tener entre 18 y 26 dígitos'),
  }),
};

export const updateWalletSchema = {
  params: z.object({ id: mongoId }),
  body: z.object({
    cbu: z.string().trim().refine((v) => /^\d{18,26}$/.test(v), 'CBU/CVU debe tener entre 18 y 26 dígitos'),
  }),
};

export const deleteWalletSchema = {
  params: z.object({ id: mongoId }),
};
