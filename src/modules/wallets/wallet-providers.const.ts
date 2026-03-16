/**
 * Supported wallet providers (billeteras) - one CBU per provider per user
 */

export interface WalletProvider {
  id: string;
  name: string;
  color: string;
  /** Use dark text on light backgrounds (e.g. Bitso, Lemon Cash) */
  darkFont?: boolean;
}

export const WALLET_PROVIDERS: WalletProvider[] = [
  { id: 'mercadopago', name: 'Mercado Pago', color: '#009EE3' },
  { id: 'uala', name: 'Ualá', color: '#7B1FA2' },
  { id: 'naranjax', name: 'Naranja X', color: '#FF6A00' },
  { id: 'personalpay', name: 'Personal Pay', color: '#00AEEF' },
  { id: 'modo', name: 'MODO', color: '#6A00FF' },
  { id: 'cuentadni', name: 'Cuenta DNI', color: '#0096D6' },
  { id: 'brubank', name: 'Brubank', color: '#5B3CC4' },
  { id: 'prex', name: 'Prex', color: '#00A859' },
  { id: 'lemoncash', name: 'Lemon Cash', color: '#FFD600', darkFont: true },
  { id: 'claropay', name: 'Claro Pay', color: '#E60000' },
  { id: 'astropay', name: 'AstroPay', color: '#4B2AAD' },
  { id: 'todopago', name: 'Todo Pago', color: '#E6007E' },
  { id: 'n1u', name: 'N1U', color: '#111111' },
  { id: 'cocospay', name: 'Cocos Pay', color: '#00C08B' },
  { id: 'letsbit', name: 'LetsBit', color: '#F7931A' },
  { id: 'ripio', name: 'Ripio', color: '#2E5BFF' },
  { id: 'bitso', name: 'Bitso', color: '#00E6A8', darkFont: true },
  { id: 'yoy', name: 'Yoy', color: '#FF3366' },
  { id: 'buepp', name: 'Buepp', color: '#0057FF' },
  { id: 'ieb', name: 'IEB+', color: '#1F2A44' },
];

const PROVIDERS_BY_ID = new Map(WALLET_PROVIDERS.map((p) => [p.id, p]));

export function getWalletProvider(id: string): WalletProvider | undefined {
  return PROVIDERS_BY_ID.get(id);
}

export function getWalletProviderIds(): string[] {
  return WALLET_PROVIDERS.map((p) => p.id);
}
