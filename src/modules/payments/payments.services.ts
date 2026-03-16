/**
 * Payments services - Transfer info (wallets/CBU + monto)
 *
 * El monto a cobrar es siempre la DIFERENCIA (saldo neto) entre acreedor y deudor:
 * si usuario1 cobra 100 a usuario2 y usuario2 cobra 80 a usuario1,
 * usuario2 solo debe transferir 20 a usuario1.
 */

import { UsuarioModel } from '../usuarios/usuario.model.ts';
import { getSettings } from '../usuarios/user-settings.service.ts';
import { listWalletsByUserId } from '../wallets/wallets.service.ts';
import { computeBilateralBalance } from '../compras/balance.service.ts';
import { BadRequestError, NotFoundError } from '../../utils/errors.ts';

export interface GetTransferInfoInput {
  deudorId: string;
  acreedorId: string;
  compraIds?: string[];
}

export interface TransferInfoWallet {
  name: string;
  color: string;
  cbu: string;
  darkFont?: boolean;
}

export interface TransferInfoResult {
  wallets: TransferInfoWallet[];
  monto: number;
  descripcion: string;
  acreedorUsername: string;
}

export async function getTransferInfoService(
  input: GetTransferInfoInput,
): Promise<TransferInfoResult> {
  const { deudorId, acreedorId } = input;

  if (deudorId === acreedorId) {
    throw new BadRequestError('No puedes generar datos de pago para ti mismo');
  }

  const acreedor = await UsuarioModel.findById(acreedorId);
  if (!acreedor) {
    throw new NotFoundError('Acreedor no encontrado');
  }

  // Monto = saldo neto (diferencia). Desde el punto de vista del deudor: balance = lo que me deben - lo que debo.
  // Si balance < 0, el deudor debe pagar |balance| al acreedor.
  const bilateral = await computeBilateralBalance(deudorId, acreedorId);
  if (bilateral.balance >= 0) {
    throw new BadRequestError(
      bilateral.balance === 0
        ? 'No tienes deuda pendiente con este usuario'
        : 'El saldo neto no genera un pago a tu favor',
    );
  }
  const montoTotal = Math.round(-bilateral.balance * 100) / 100;

  const wallets = await listWalletsByUserId(acreedorId);
  const legacyCbu = acreedor.cbu?.trim();
  let transferWallets: TransferInfoWallet[] = [];
  if (wallets.length > 0) {
    const settings = await getSettings(acreedorId);
    const favoriteId = settings.favoriteWalletId;
    const favorite = favoriteId ? wallets.find((w) => w._id === favoriteId) : null;
    if (favorite) {
      transferWallets = [
        { name: favorite.name, color: favorite.color, cbu: favorite.cbu, darkFont: favorite.darkFont },
      ];
    } else {
      throw new BadRequestError(
        'El cobrador debe elegir una billetera favorita en su perfil para recibir pagos',
      );
    }
  } else if (legacyCbu) {
    transferWallets = [{ name: 'CBU', color: '#7F00FF', cbu: legacyCbu }];
  }
  if (transferWallets.length === 0) {
    throw new BadRequestError('El cobrador no tiene CBU ni billeteras configuradas para recibir el pago');
  }

  const descripcion = `Pago saldo neto a ${acreedor.username}`;

  return {
    wallets: transferWallets,
    monto: montoTotal,
    descripcion,
    acreedorUsername: acreedor.username,
  };
}
