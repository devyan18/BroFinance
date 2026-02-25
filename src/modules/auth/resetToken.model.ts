import { Schema, model, Document, Types } from 'mongoose';

type ResetToken = Document & {
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
};

const resetTokenSchema = new Schema<ResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Auto-eliminar tokens expirados
resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResetTokenModel = model<ResetToken>('ResetToken', resetTokenSchema);
