/**
 * User settings service (preferencias de cuenta en Mongo)
 */

import { UserSettingsModel, IUserSettings } from './user-settings.model.ts';
import { Types } from 'mongoose';

const DEFAULTS = {
  notifyNewChargesEmail: true,
  notifyNewChargesPush: true,
};

export async function getOrCreateSettings(userId: string): Promise<IUserSettings> {
  const doc = await UserSettingsModel.findOne({ userId: new Types.ObjectId(userId) });
  if (doc) return doc;
  const created = await UserSettingsModel.create({
    userId: new Types.ObjectId(userId),
    ...DEFAULTS,
  });
  return created;
}

export async function getSettings(userId: string): Promise<{
  notifyNewChargesEmail: boolean;
  notifyNewChargesPush: boolean;
  favoriteWalletId?: string | null;
}> {
  const doc = await UserSettingsModel.findOne({ userId: new Types.ObjectId(userId) });
  if (!doc) return { ...DEFAULTS, favoriteWalletId: null };
  return {
    notifyNewChargesEmail: doc.notifyNewChargesEmail ?? DEFAULTS.notifyNewChargesEmail,
    notifyNewChargesPush: doc.notifyNewChargesPush ?? DEFAULTS.notifyNewChargesPush,
    favoriteWalletId: doc.favoriteWalletId?.toString() ?? null,
  };
}

export async function updateSettings(
  userId: string,
  updates: {
    notifyNewChargesEmail?: boolean;
    notifyNewChargesPush?: boolean;
    favoriteWalletId?: string | null;
  },
): Promise<{
  notifyNewChargesEmail: boolean;
  notifyNewChargesPush: boolean;
  favoriteWalletId?: string | null;
}> {
  const set: Record<string, unknown> = {};
  if (updates.notifyNewChargesEmail !== undefined) set.notifyNewChargesEmail = updates.notifyNewChargesEmail;
  if (updates.notifyNewChargesPush !== undefined) set.notifyNewChargesPush = updates.notifyNewChargesPush;
  if (updates.favoriteWalletId !== undefined) {
    set.favoriteWalletId = updates.favoriteWalletId ? new Types.ObjectId(updates.favoriteWalletId) : null;
  }
  const doc = await UserSettingsModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    Object.keys(set).length ? { $set: set } : {},
    { new: true, upsert: true, runValidators: true },
  );
  return {
    notifyNewChargesEmail: doc.notifyNewChargesEmail ?? DEFAULTS.notifyNewChargesEmail,
    notifyNewChargesPush: doc.notifyNewChargesPush ?? DEFAULTS.notifyNewChargesPush,
    favoriteWalletId: doc.favoriteWalletId?.toString() ?? null,
  };
}
