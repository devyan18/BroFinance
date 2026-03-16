import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../createTestApp.ts';
import { createTestUser, authHeaders } from '../helpers/auth.helpers.ts';
import { makeFriends, getDefaultTipoId, createCompra } from '../helpers/db.helpers.ts';
import { UsuarioModel } from '../../modules/usuarios/usuario.model.ts';

const app = createTestApp();
const BASE = '/api/v1/payments';

describe('POST /payments/transfer-info', () => {
  it('returns CBU and amount when debtor has a pending debt', async () => {
    const creditor = await createTestUser({ cbu: '1234567890123456789012' });
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: creditor._id,
      deudorId: debtor._id,
      tipoId,
      montoDeudor: 75,
      estado: 'aceptado',
    });

    await UsuarioModel.findByIdAndUpdate(creditor._id, { cbu: '1234567890123456789012' });

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(debtor))
      .send({ acreedorId: creditor._id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallets).toBeDefined();
    expect(Array.isArray(res.body.data.wallets)).toBe(true);
    expect(res.body.data.wallets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.wallets[0].cbu).toBe('1234567890123456789012');
    expect(res.body.data.monto).toBe(75);
    expect(res.body.data.acreedorUsername).toBe(creditor.username);
  });

  it('returns transfer amount as NET balance (difference between mutual debts)', async () => {
    const user1 = await createTestUser({ cbu: '1234567890123456789012' });
    const user2 = await createTestUser();
    await makeFriends(user1._id, user2._id);
    const tipoId = await getDefaultTipoId();
    // user1 cobra 100 a user2; user2 cobra 80 a user1 → net: user2 paga 20 a user1
    await createCompra({
      acreedorId: user1._id,
      deudorId: user2._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: user2._id,
      deudorId: user1._id,
      tipoId,
      montoDeudor: 80,
      estado: 'aceptado',
    });

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(user2))
      .send({ acreedorId: user1._id });

    expect(res.status).toBe(200);
    expect(res.body.data.monto).toBe(20);
  });

  it('returns 400 when there are no pending debts', async () => {
    const creditor = await createTestUser({ cbu: '1234567890123456789012' });
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(debtor))
      .send({ acreedorId: creditor._id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when deudorId equals acreedorId (self-payment)', async () => {
    const user = await createTestUser();

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(user))
      .send({ acreedorId: user._id });

    expect(res.status).toBe(400);
  });

  it('returns transfer info for specific compraIds', async () => {
    const creditor = await createTestUser({ cbu: '1234567890123456789012' });
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({
      acreedorId: creditor._id,
      deudorId: debtor._id,
      tipoId,
      montoDeudor: 50,
      estado: 'aceptado',
    });

    await UsuarioModel.findByIdAndUpdate(creditor._id, { cbu: '1234567890123456789012' });

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(debtor))
      .send({ acreedorId: creditor._id, compraIds: [compra._id.toString()] });

    expect(res.status).toBe(200);
    expect(res.body.data.monto).toBe(50);
  });

  it('returns 400 for invalid compraIds', async () => {
    const creditor = await createTestUser({ cbu: '1234567890123456789012' });
    const debtor = await createTestUser();
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(debtor))
      .send({
        acreedorId: creditor._id,
        compraIds: ['000000000000000000000001'],
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 when acreedorId is missing', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .set(authHeaders(user))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const creditor = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/transfer-info`)
      .send({ acreedorId: creditor._id });
    expect(res.status).toBe(401);
  });
});
