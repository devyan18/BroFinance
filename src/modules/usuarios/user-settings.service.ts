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
}> {
  const doc = await UserSettingsModel.findOne({ userId: new Types.ObjectId(userId) });
  if (!doc) return DEFAULTS;
  return {
    notifyNewChargesEmail: doc.notifyNewChargesEmail ?? DEFAULTS.notifyNewChargesEmail,
    notifyNewChargesPush: doc.notifyNewChargesPush ?? DEFAULTS.notifyNewChargesPush,
  };
}

export async function updateSettings(
  userId: string,
  updates: { notifyNewChargesEmail?: boolean; notifyNewChargesPush?: boolean },
): Promise<{ notifyNewChargesEmail: boolean; notifyNewChargesPush: boolean }> {
  const doc = await UserSettingsModel.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $set: updates },
    { new: true, upsert: true, runValidators: true },
  );
  return {
    notifyNewChargesEmail: doc.notifyNewChargesEmail ?? DEFAULTS.notifyNewChargesEmail,
    notifyNewChargesPush: doc.notifyNewChargesPush ?? DEFAULTS.notifyNewChargesPush,
  };
}
