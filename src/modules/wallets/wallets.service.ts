/**
 * Wallets service - CRUD for user wallets (one CBU per provider)
 */

import { Types } from 'mongoose';
import { UserWalletModel } from './user-wallet.model.ts';
import { getWalletProvider } from './wallet-providers.const.ts';
import { getSettings, updateSettings } from '../usuarios/user-settings.service.ts';
import { NotFoundError, BadRequestError } from '../../utils/errors.ts';

export interface WalletDto {
  _id: string;
  providerKey: string;
  name: string;
  color: string;
  cbu: string;
  darkFont?: boolean;
}

function toDto(w: { _id: Types.ObjectId; providerKey: string; cbu: string }): WalletDto {
  const provider = getWalletProvider(w.providerKey);
  return {
    _id: w._id.toString(),
    providerKey: w.providerKey,
    name: provider?.name ?? w.providerKey,
    color: provider?.color ?? '#7F00FF',
    cbu: w.cbu,
    darkFont: provider?.darkFont ?? false,
  };
}

export async function listWalletsByUserId(userId: string): Promise<WalletDto[]> {
  const list = await UserWalletModel.find({ userId: new Types.ObjectId(userId) }).lean();
  return list.map(toDto);
}

export async function addWallet(
  userId: string,
  providerKey: string,
  cbu: string,
): Promise<WalletDto> {
  const provider = getWalletProvider(providerKey);
  if (!provider) {
    throw new BadRequestError('Proveedor de billetera no válido');
  }
  const trimmed = cbu.trim();
  if (!/^\d{18,26}$/.test(trimmed)) {
    throw new BadRequestError('CBU/CVU debe tener entre 18 y 26 dígitos');
  }
  const existing = await UserWalletModel.findOne({
    userId: new Types.ObjectId(userId),
    providerKey,
  });
  if (existing) {
    existing.cbu = trimmed;
    await existing.save();
    return toDto(existing);
  }
  const doc = await UserWalletModel.create({
    userId: new Types.ObjectId(userId),
    providerKey,
    cbu: trimmed,
  });
  const count = await UserWalletModel.countDocuments({ userId: new Types.ObjectId(userId) });
  if (count === 1) {
    await updateSettings(userId, { favoriteWalletId: doc._id.toString() });
  }
  return toDto(doc);
}

export async function updateWallet(
  userId: string,
  walletId: string,
  cbu: string,
): Promise<WalletDto> {
  const trimmed = cbu.trim();
  if (!/^\d{18,26}$/.test(trimmed)) {
    throw new BadRequestError('CBU/CVU debe tener entre 18 y 26 dígitos');
  }
  const doc = await UserWalletModel.findOneAndUpdate(
    { _id: new Types.ObjectId(walletId), userId: new Types.ObjectId(userId) },
    { cbu: trimmed },
    { new: true },
  );
  if (!doc) {
    throw new NotFoundError('Billetera no encontrada');
  }
  return toDto(doc);
}

export async function deleteWallet(userId: string, walletId: string): Promise<void> {
  const settings = await getSettings(userId);
  const wasFavorite = settings.favoriteWalletId === walletId;
  const result = await UserWalletModel.deleteOne({
    _id: new Types.ObjectId(walletId),
    userId: new Types.ObjectId(userId),
  });
  if (result.deletedCount === 0) {
    throw new NotFoundError('Billetera no encontrada');
  }
  if (wasFavorite) {
    const remaining = await UserWalletModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
    await updateSettings(userId, {
      favoriteWalletId: remaining ? remaining._id.toString() : null,
    });
  }
}
