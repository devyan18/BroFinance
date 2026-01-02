import { Schema, model, Document, Types } from "mongoose";
import { UsuarioModel } from "../usuarios/usuario.model";

type Compra = Document & {
  descripcion: string;
  montoTotal: number;
  montoAcreedor: number;
  montoDeudor: number;
  acreedorId: Types.ObjectId;
  deudorId: Types.ObjectId;
};

const ComprasSchema = new Schema<Compra>(
  {
    acreedorId: { type: Types.ObjectId, ref: "Usuario", required: true },
    deudorId: { type: Types.ObjectId, ref: "Usuario", required: true },
    descripcion: { type: String, required: true },
    montoTotal: { type: Number, required: true },
    montoAcreedor: { type: Number, required: true },
    montoDeudor: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ComprasSchema.pre<Compra>("save", async function (_next) {
  const deudor = await UsuarioModel.findById(this.deudorId);
  if (!deudor) return;

  deudor.deficit += this.montoDeudor;
  await deudor.save();
});

export const ComprasModel = model<Compra>("Compra", ComprasSchema);
