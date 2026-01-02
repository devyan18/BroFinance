import { Schema, model, Document } from "mongoose";
import { hash, genSalt } from "bcrypt";

type Usuario = Document & {
  username: string;
  email: string;
  password: string;
  deficit: number;
  superavit: number;
};

const UsuarioSchema = new Schema<Usuario>(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    deficit: { type: Number, default: 0 },
    superavit: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UsuarioSchema.pre<Usuario>("save", async function (_next) {
  if (!this.isModified("password")) return;

  const salt = await genSalt(10);
  this.password = await hash(this.password, salt);
});

export const UsuarioModel = model<Usuario>("Usuario", UsuarioSchema);
