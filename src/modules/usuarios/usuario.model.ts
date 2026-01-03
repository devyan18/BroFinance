import { Schema, model, Document } from 'mongoose';
import { hash, genSalt } from 'bcrypt';

type Usuario = Document & {
  username: string;
  avatarUrl?: string;
  email: string;
  password: string;
  provider: 'local' | 'google';
  balance: number;
};

const UsuarioSchema = new Schema<Usuario>(
  {
    username: { type: String, required: true },
    avatarUrl: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false, select: false },
    provider: { type: String, required: true, enum: ['local', 'google'] },
    balance: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

UsuarioSchema.pre<Usuario>('save', async function (_next) {
  if (!this.isModified('password')) return;

  const salt = await genSalt(10);
  this.password = await hash(this.password, salt);
});

export const UsuarioModel = model<Usuario>('Usuario', UsuarioSchema);
