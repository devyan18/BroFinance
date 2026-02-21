/**
 * Usuario (User) Model
 * Defines the schema and model for user authentication and profile
 */

import { Schema, model, Document } from 'mongoose';
import { hash, genSalt } from 'bcrypt';

/**
 * Supported authentication providers
 */
type Provider = 'local' | 'google' | 'github';

/**
 * Usuario document interface
 */
export interface IUsuario extends Document {
  username: string;
  avatarUrl?: string;
  email: string;
  password: string;
  provider: Provider[];
  balance: number;
  cbu?: string;
  showCbu?: boolean;
  showEmail?: boolean;
  needsPasswordSetup?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Usuario schema definition
 */
const UsuarioSchema = new Schema<IUsuario>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    avatarUrl: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: false,
      select: false,
      minlength: [5, 'Password must be at least 5 characters'],
    },
    provider: {
      type: [String],
      enum: {
        values: ['local', 'google', 'github'],
        message: '{VALUE} is not a supported provider',
      },
      default: ['local'],
    },
    balance: {
      type: Number,
      default: 0,
      // Positivo = te deben, negativo = debes (según compras)
    },
    cbu: {
      type: String,
      required: false,
      trim: true,
      // CBU/CVU para recibir transferencias
      validate: {
        validator: (v: string) => !v || /^\d{18,26}$/.test(v),
        message: 'CBU/CVU debe tener entre 18 y 26 dígitos',
      },
    },
    // Visibilidad para otros usuarios
    showCbu: { type: Boolean, default: true },
    showEmail: { type: Boolean, default: false },
    // Usuarios nuevos creados via Google deben crear contraseña antes de poder usar el login local
    needsPasswordSetup: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * Pre-save hook to hash password before saving
 */
UsuarioSchema.pre<IUsuario>('save', async function () {
  // Only hash password if it has been modified and actually exists
  if (!this.isModified('password') || !this.password) return;

  const salt = await genSalt(10);
  this.password = await hash(this.password, salt);
});

/**
 * Usuario model
 */
export const UsuarioModel = model<IUsuario>('Usuario', UsuarioSchema);
