import { FriendshipModel } from '../../modules/friends/friends.model.ts';
import { ComprasModel, TipoCompraModel } from '../../modules/compras/compras.model.ts';
import { Types } from 'mongoose';

export async function makeFriends(userIdA: string, userIdB: string) {
  return FriendshipModel.create({
    requesterId: new Types.ObjectId(userIdA),
    addresseeId: new Types.ObjectId(userIdB),
    status: 'accepted',
  });
}

export async function getDefaultTipoId(): Promise<string> {
  const tipo = await TipoCompraModel.findOne({ descripcion: 'Otros' });
  if (!tipo) throw new Error('TipoCompra "Otros" not found — run seedTiposCompra first');
  return tipo._id.toString();
}

export async function createCompra(overrides: {
  acreedorId: string;
  deudorId: string;
  tipoId: string;
  descripcion?: string;
  montoTotal?: number;
  montoDeudor?: number;
  estado?: 'pendiente' | 'aceptado' | 'rechazado' | 'pago_pendiente' | 'pagado';
}) {
  return ComprasModel.create({
    acreedorId: new Types.ObjectId(overrides.acreedorId),
    deudorId: new Types.ObjectId(overrides.deudorId),
    tipo: new Types.ObjectId(overrides.tipoId),
    descripcion: overrides.descripcion ?? 'Gasto de prueba',
    montoTotal: overrides.montoTotal ?? 100,
    montoAcreedor: overrides.montoDeudor ?? 50,
    montoDeudor: overrides.montoDeudor ?? 50,
    estado: overrides.estado ?? 'pendiente',
  });
}
