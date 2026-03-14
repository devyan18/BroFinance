/**
 * Balance service: computes bilateral (net) balance between two users
 * from the history of transactions (compras). Uses an optional pivot:
 * when the pair last had zero balance, we only sum compras after that date
 * to avoid scanning long history.
 *
 * Only compras with estado in ['aceptado', 'pago_pendiente'] are included.
 *
 * Balance from myUserId's POV:
 * - totalACobrar: sum of montoAcreedor where I am acreedor and other is deudor
 * - totalAPagar: sum of montoDeudor where I am deudor and other is acreedor
 * - balance = totalACobrar - totalAPagar
 */

import { Types } from 'mongoose';
import { ComprasModel } from './compras.model';
import { BalancePivotModel } from './balance-pivot.model';

const ESTADOS_PENDIENTES_DE_PAGO = ['aceptado', 'pago_pendiente'] as const;

export type BilateralBalanceResult = {
  totalACobrar: number;
  totalAPagar: number;
  balance: number;
  estado: 'te deben' | 'debes' | 'cuadrado';
};

function canonicalPair(id1: Types.ObjectId, id2: Types.ObjectId): [Types.ObjectId, Types.ObjectId] {
  const s1 = id1.toString();
  const s2 = id2.toString();
  return s1 <= s2 ? [id1, id2] : [id2, id1];
}

function aggregateBalance(
  myId: Types.ObjectId,
  otherId: Types.ObjectId,
  afterDate: Date | null,
): Promise<{ totalACobrar: number; totalAPagar: number; maxCreatedAt: Date | null }> {
  const dateFilter = afterDate ? { createdAt: { $gt: afterDate } } : {};
  const matchAcreedor = {
    acreedorId: myId,
    deudorId: otherId,
    estado: { $in: ESTADOS_PENDIENTES_DE_PAGO },
    ...dateFilter,
  };
  const matchDeudor = {
    acreedorId: otherId,
    deudorId: myId,
    estado: { $in: ESTADOS_PENDIENTES_DE_PAGO },
    ...dateFilter,
  };

  return Promise.all([
    ComprasModel.aggregate<{ total: number; maxCreatedAt: Date }>([
      { $match: matchAcreedor },
      {
        $group: {
          _id: null,
          total: { $sum: '$montoAcreedor' },
          maxCreatedAt: { $max: '$createdAt' },
        },
      },
    ]),
    ComprasModel.aggregate<{ total: number; maxCreatedAt: Date }>([
      { $match: matchDeudor },
      {
        $group: {
          _id: null,
          total: { $sum: '$montoDeudor' },
          maxCreatedAt: { $max: '$createdAt' },
        },
      },
    ]),
  ]).then(([acreedorRes, deudorRes]) => {
    const totalACobrar = acreedorRes[0]?.total ?? 0;
    const totalAPagar = deudorRes[0]?.total ?? 0;
    const maxA = acreedorRes[0]?.maxCreatedAt;
    const maxB = deudorRes[0]?.maxCreatedAt;
    const maxCreatedAt =
      maxA && maxB ? (maxA > maxB ? maxA : maxB) : maxA ?? maxB ?? null;
    return { totalACobrar, totalAPagar, maxCreatedAt };
  });
}

/**
 * Computes the net balance between two users from the perspective of myUserId.
 * If a pivot exists (balance was 0 at some point), only compras after pivotAt
 * are aggregated. When full balance is 0, a pivot is created/updated so future
 * calls can use the short path.
 */
export async function computeBilateralBalance(
  myUserId: string,
  otherUserId: string,
): Promise<BilateralBalanceResult> {
  const myId = new Types.ObjectId(myUserId);
  const otherId = new Types.ObjectId(otherUserId);
  const [user1Id, user2Id] = canonicalPair(myId, otherId);

  const pivot = await BalancePivotModel.findOne({ user1Id, user2Id }).lean();
  const pivotAt = pivot?.pivotAt ?? null;

  const { totalACobrar, totalAPagar, maxCreatedAt } = await aggregateBalance(
    myId,
    otherId,
    pivotAt,
  );
  const balance = totalACobrar - totalAPagar;

  if (balance === 0) {
    const pivotAtValue = maxCreatedAt ?? new Date();
    await BalancePivotModel.findOneAndUpdate(
      { user1Id, user2Id },
      { $set: { pivotAt: pivotAtValue } },
      { upsert: true },
    );
  }

  const estado: BilateralBalanceResult['estado'] =
    balance > 0 ? 'te deben' : balance < 0 ? 'debes' : 'cuadrado';

  return { totalACobrar, totalAPagar, balance, estado };
}
