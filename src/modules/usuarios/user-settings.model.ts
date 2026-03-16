/**
 * UserSettings (configuración de cuenta)
 * Preferencias que viven en Mongo y se sincronizan entre dispositivos.
 * Separado del modelo Usuario (identidad y perfil) para escalar a más opciones.
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IUserSettings extends Document {
  userId: Types.ObjectId;
  notifyNewChargesEmail: boolean;
  notifyNewChargesPush: boolean;
  favoriteWalletId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      unique: true,
    },
    notifyNewChargesEmail: { type: Boolean, default: true },
    notifyNewChargesPush: { type: Boolean, default: true },
    favoriteWalletId: { type: Schema.Types.ObjectId, ref: 'UserWallet', required: false },
  },
  { timestamps: true, versionKey: false },
);

export const UserSettingsModel = model<IUserSettings>('UserSettings', UserSettingsSchema);
