/**
 * Balance pivot: momento en que el balance entre dos usuarios estaba en cero.
 * Permite calcular el balance actual solo desde compras posteriores al pivot,
 * sin recorrer todo el historial.
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IBalancePivot extends Document {
  user1Id: Types.ObjectId;
  user2Id: Types.ObjectId;
  pivotAt: Date;
  updatedAt: Date;
}

const BalancePivotSchema = new Schema<IBalancePivot>(
  {
    user1Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    user2Id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    pivotAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

BalancePivotSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

export const BalancePivotModel = model<IBalancePivot>('BalancePivot', BalancePivotSchema);
