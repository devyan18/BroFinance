import { Schema, model, Document, Types } from 'mongoose';
import { UsuarioModel } from '../usuarios/usuario.model';

type Compra = Document & {
  descripcion: string;
  montoTotal: number;
  montoAcreedor: number;
  montoDeudor: number;
  tipo: Types.ObjectId;
  acreedorId: Types.ObjectId;
  deudorId: Types.ObjectId;
};

type TipoCompra = Document & {
  descripcion: string;
};

const TipoCompraSchema = new Schema<TipoCompra>(
  {
    descripcion: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const ComprasSchema = new Schema<Compra>(
  {
    acreedorId: { type: Types.ObjectId, ref: 'Usuario', required: true },
    deudorId: { type: Types.ObjectId, ref: 'Usuario', required: true },
    descripcion: { type: String, required: true },
    tipo: {
      type: Types.ObjectId,
      ref: 'TipoCompra',
      required: true,
    },
    montoTotal: { type: Number, required: true },
    montoAcreedor: { type: Number, required: true },
    montoDeudor: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ComprasSchema.pre<Compra>('save', async function (_next) {
  const deudor = await UsuarioModel.findById(this.deudorId);
  if (!deudor) throw new Error('Deudor not found');

  const acreedor = await UsuarioModel.findById(this.acreedorId);
  if (!acreedor) throw new Error('Acreedor not found');

  deudor.balance -= this.montoDeudor;
  acreedor.balance += this.montoDeudor;
  await deudor.save();
});

export const ComprasModel = model<Compra>('Compra', ComprasSchema);
export const TipoCompraModel = model<TipoCompra>('TipoCompra', TipoCompraSchema);
