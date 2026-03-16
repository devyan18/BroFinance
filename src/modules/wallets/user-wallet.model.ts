/**
 * UserWallet - one CBU per wallet provider per user
 */

import { Schema, model, Document, Types } from 'mongoose';
import { getWalletProviderIds } from './wallet-providers.const.ts';

export interface IUserWallet extends Document {
  userId: Types.ObjectId;
  providerKey: string;
  cbu: string;
  createdAt: Date;
  updatedAt: Date;
}

const cbuValidator = (v: string) => /^\d{18,26}$/.test(v);

const UserWalletSchema = new Schema<IUserWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    providerKey: {
      type: String,
      required: true,
      enum: {
        values: getWalletProviderIds(),
        message: 'Proveedor de billetera no válido',
      },
    },
    cbu: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: cbuValidator,
        message: 'CBU/CVU debe tener entre 18 y 26 dígitos',
      },
    },
  },
  { timestamps: true, versionKey: false },
);

UserWalletSchema.index({ userId: 1, providerKey: 1 }, { unique: true });

export const UserWalletModel = model<IUserWallet>('UserWallet', UserWalletSchema);
