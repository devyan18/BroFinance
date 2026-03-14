import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { computeBilateralBalance } from '../../modules/compras/balance.service.ts';
import { ComprasModel } from '../../modules/compras/compras.model.ts';
import { createTestUser } from '../helpers/auth.helpers.ts';
import { makeFriends, getDefaultTipoId, createCompra } from '../helpers/db.helpers.ts';

const ESTADOS_QUE_CUENTAN = ['aceptado', 'pago_pendiente'];

describe('computeBilateralBalance', () => {
  it('returns zero when there are no compras between the two users', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(0);
    expect(result.totalAPagar).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.estado).toBe('cuadrado');
  });

  it('from debtor POV: only one compra where I owe (acreedor B, deudor A) → balance negative', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(0);
    expect(result.totalAPagar).toBe(100);
    expect(result.balance).toBe(-100);
    expect(result.estado).toBe('debes');
  });

  it('from creditor POV: only one compra where they owe me (acreedor A, deudor B) → balance positive', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 80,
      estado: 'aceptado',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(80);
    expect(result.totalAPagar).toBe(0);
    expect(result.balance).toBe(80);
    expect(result.estado).toBe('te deben');
  });

  it('netting: A owed B 100, then A charged B 60 → A still owes B 40', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 60,
      estado: 'aceptado',
    });

    const fromA = await computeBilateralBalance(userA._id, userB._id);
    expect(fromA.totalACobrar).toBe(60);
    expect(fromA.totalAPagar).toBe(100);
    expect(fromA.balance).toBe(-40);
    expect(fromA.estado).toBe('debes');

    const fromB = await computeBilateralBalance(userB._id, userA._id);
    expect(fromB.totalACobrar).toBe(100);
    expect(fromB.totalAPagar).toBe(60);
    expect(fromB.balance).toBe(40);
    expect(fromB.estado).toBe('te deben');
  });

  it('netting: A owed B 100, then A charged B 150 → B owes A 50', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 150,
      estado: 'aceptado',
    });

    const fromA = await computeBilateralBalance(userA._id, userB._id);
    expect(fromA.totalACobrar).toBe(150);
    expect(fromA.totalAPagar).toBe(100);
    expect(fromA.balance).toBe(50);
    expect(fromA.estado).toBe('te deben');

    const fromB = await computeBilateralBalance(userB._id, userA._id);
    expect(fromB.totalACobrar).toBe(100);
    expect(fromB.totalAPagar).toBe(150);
    expect(fromB.balance).toBe(-50);
    expect(fromB.estado).toBe('debes');
  });

  it('excludes pendiente and rechazado compras from balance', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 100,
      estado: 'pendiente',
    });
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 30,
      estado: 'rechazado',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(0);
    expect(result.totalAPagar).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.estado).toBe('cuadrado');
  });

  it('includes pago_pendiente compras in balance', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 25,
      estado: 'pago_pendiente',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(25);
    expect(result.totalAPagar).toBe(0);
    expect(result.balance).toBe(25);
    expect(result.estado).toBe('te deben');
  });

  it('excludes pagado compras from balance', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 50,
      estado: 'pagado',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);
    expect(result.totalACobrar).toBe(0);
    expect(result.totalAPagar).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.estado).toBe('cuadrado');
  });

  it('balance is dynamic: computed from historial at request time (no cache)', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 40,
      estado: 'aceptado',
    });

    const result = await computeBilateralBalance(userA._id, userB._id);

    const historial = await ComprasModel.find({
      $or: [
        { acreedorId: new Types.ObjectId(userA._id), deudorId: new Types.ObjectId(userB._id) },
        { acreedorId: new Types.ObjectId(userB._id), deudorId: new Types.ObjectId(userA._id) },
      ],
      estado: { $in: ESTADOS_QUE_CUENTAN },
    }).lean();

    let expectedACobrar = 0;
    let expectedAPagar = 0;
    for (const c of historial) {
      const acreedorStr = (c.acreedorId as Types.ObjectId).toString();
      const deudorStr = (c.deudorId as Types.ObjectId).toString();
      if (acreedorStr === userA._id && deudorStr === userB._id) {
        expectedACobrar += c.montoAcreedor ?? 0;
      } else if (acreedorStr === userB._id && deudorStr === userA._id) {
        expectedAPagar += c.montoDeudor ?? 0;
      }
    }
    const expectedBalance = expectedACobrar - expectedAPagar;

    expect(result.totalACobrar).toBe(expectedACobrar);
    expect(result.totalAPagar).toBe(expectedAPagar);
    expect(result.balance).toBe(expectedBalance);
  });
});
