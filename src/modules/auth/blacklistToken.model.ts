import { Schema, model, Document, Types } from 'mongoose';

type BlacklistToken = Document & {
  token: string;
  blacklistedAt: Date;
  user: Types.ObjectId;
};

const BlacklistSchema = new Schema<BlacklistToken>(
  {
    token: { type: String, required: true, unique: true },
    blacklistedAt: { type: Date, default: Date.now },
    user: { type: Types.ObjectId, ref: 'Usuario', required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const BlacklistModel = model<BlacklistToken>('BlacklistToken', BlacklistSchema);
