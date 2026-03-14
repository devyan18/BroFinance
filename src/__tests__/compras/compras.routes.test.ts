import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp } from '../createTestApp.ts';
import { createTestUser, authHeaders } from '../helpers/auth.helpers.ts';
import { makeFriends, getDefaultTipoId, createCompra } from '../helpers/db.helpers.ts';
import { ComprasModel } from '../../modules/compras/compras.model.ts';

const app = createTestApp();
const BASE = '/api/v1/compras';

describe('GET /compras/tipos', () => {
  it('returns seeded purchase types', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`${BASE}/tipos`).set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((t: any) => t.descripcion === 'Supermercado')).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/tipos`);
    expect(res.status).toBe(401);
  });
});

describe('GET /compras/usuarios', () => {
  it('returns friends available for creating expenses', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const res = await request(app).get(`${BASE}/usuarios`).set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: any) => u.username === b.username)).toBe(true);
  });

  it('returns empty array when user has no friends', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`${BASE}/usuarios`).set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/usuarios`);
    expect(res.status).toBe(401);
  });
});

describe('POST /compras', () => {
  it('creates an expense between two friends', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(BASE)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Supermercado compartido',
        montoTotal: 200,
        montoDeudor: 100,
        tipo: tipoId,
        deudorId: debtor._id,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.descripcion).toBe('Supermercado compartido');
  });

  it('returns 403 when debtor is not a friend', async () => {
    const creditor = await createTestUser();
    const stranger = await createTestUser();
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(BASE)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Test',
        montoTotal: 100,
        montoDeudor: 50,
        tipo: tipoId,
        deudorId: stranger._id,
      });
    expect(res.status).toBe(403);
  });

  it('returns 400 when montoDeudor > montoTotal', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(BASE)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Test',
        montoTotal: 100,
        montoDeudor: 200,
        tipo: tipoId,
        deudorId: debtor._id,
      });
    expect(res.status).toBe(400);
  });

  it('creates a personal expense (no deudorId)', async () => {
    const user = await createTestUser();
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(BASE)
      .set(authHeaders(user))
      .send({
        descripcion: 'Gasto personal',
        montoTotal: 50,
        montoDeudor: 50,
        tipo: tipoId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.descripcion).toBe('Gasto personal');
  });

  it('returns 400 for missing required fields', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post(BASE)
      .set(authHeaders(user))
      .send({ descripcion: 'incomplete' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const tipoId = await getDefaultTipoId();
    const res = await request(app).post(BASE).send({
      descripcion: 'Test',
      montoTotal: 100,
      montoDeudor: 50,
      tipo: tipoId,
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /compras/batch', () => {
  it('creates multiple expenses in one call', async () => {
    const creditor = await createTestUser();
    const d1 = await createTestUser();
    const d2 = await createTestUser();
    await makeFriends(creditor._id, d1._id);
    await makeFriends(creditor._id, d2._id);
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(`${BASE}/batch`)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Cena grupal',
        montoTotal: 300,
        tipo: tipoId,
        deudores: [
          { deudorId: d1._id, montoDeudor: 100 },
          { deudorId: d2._id, montoDeudor: 100 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns 403 when a debtor is not a friend', async () => {
    const creditor = await createTestUser();
    const friend = await createTestUser();
    const stranger = await createTestUser();
    await makeFriends(creditor._id, friend._id);
    const tipoId = await getDefaultTipoId();

    const res = await request(app)
      .post(`${BASE}/batch`)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Test',
        montoTotal: 200,
        tipo: tipoId,
        deudores: [
          { deudorId: friend._id, montoDeudor: 100 },
          { deudorId: stranger._id, montoDeudor: 100 },
        ],
      });
    expect(res.status).toBe(403);
  });

  it('returns 400 for empty deudores array', async () => {
    const creditor = await createTestUser();
    const tipoId = await getDefaultTipoId();
    const res = await request(app)
      .post(`${BASE}/batch`)
      .set(authHeaders(creditor))
      .send({
        descripcion: 'Test',
        montoTotal: 100,
        tipo: tipoId,
        deudores: [],
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /compras', () => {
  it('returns expenses for the authenticated user with pagination', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId });

    const res = await request(app).get(BASE).set(authHeaders(creditor));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('supports pagination with page and limit params', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`${BASE}?page=1&limit=5`).set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });
});

describe('GET /compras/:id', () => {
  it('returns a specific expense by ID', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId });

    const res = await request(app)
      .get(`${BASE}/${compra._id}`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(200);
    expect(res.body.data.descripcion).toBe('Gasto de prueba');
  });

  it('returns 404 when expense not found or user has no access', async () => {
    const user = await createTestUser();
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).get(`${BASE}/${fakeId}`).set(authHeaders(user));
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).get(`${BASE}/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /compras/roommates', () => {
  it('returns roommates (friends with shared expenses)', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado', montoDeudor: 40 });

    const res = await request(app).get(`${BASE}/roommates`).set(authHeaders(creditor));
    expect(res.status).toBe(200);
    const roommate = res.body.data.find((r: any) => r.username === debtor.username);
    expect(roommate).toBeDefined();
    expect(roommate.balance).toBe(40);
  });

  it('returns bilateral balance per roommate (net with that user)', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({ acreedorId: a._id, deudorId: b._id, tipoId, montoDeudor: 100, estado: 'aceptado' });
    await createCompra({ acreedorId: b._id, deudorId: a._id, tipoId, montoDeudor: 30, estado: 'aceptado' });

    const res = await request(app).get(`${BASE}/roommates`).set(authHeaders(a));
    expect(res.status).toBe(200);
    const roommate = res.body.data.find((r: any) => r.username === b.username);
    expect(roommate).toBeDefined();
    expect(roommate.balance).toBe(70);
  });

  it('returns empty array when no shared expenses exist', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`${BASE}/roommates`).set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /compras/balance/:roommateId', () => {
  it('calculates balance correctly', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: creditor._id,
      deudorId: debtor._id,
      tipoId,
      montoDeudor: 50,
      estado: 'aceptado',
    });

    const res = await request(app)
      .get(`${BASE}/balance/${debtor._id}`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(50);
    expect(res.body.data.totalACobrar).toBe(50);
    expect(res.body.data.totalAPagar).toBe(0);
    expect(res.body.data.estado).toBe('te deben');
    expect(res.body.data.roommateId).toBe(debtor._id);
  });

  it('nets balances: creditor sees net when debtor also charged them', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 100,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: userB._id,
      deudorId: userA._id,
      tipoId,
      montoDeudor: 60,
      estado: 'aceptado',
    });

    const resA = await request(app)
      .get(`${BASE}/balance/${userB._id}`)
      .set(authHeaders(userA));
    expect(resA.status).toBe(200);
    expect(resA.body.data.balance).toBe(40);
    expect(resA.body.data.totalACobrar).toBe(100);
    expect(resA.body.data.totalAPagar).toBe(60);
    expect(resA.body.data.estado).toBe('te deben');

    const resB = await request(app)
      .get(`${BASE}/balance/${userA._id}`)
      .set(authHeaders(userB));
    expect(resB.status).toBe(200);
    expect(resB.body.data.balance).toBe(-40);
    expect(resB.body.data.estado).toBe('debes');
  });

  it('nets so that if reverse charges exceed debt, balance flips (other owes me)', async () => {
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

    const res = await request(app)
      .get(`${BASE}/balance/${userB._id}`)
      .set(authHeaders(userA));
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(50);
    expect(res.body.data.estado).toBe('te deben');
  });

  it('balance is dynamic and matches historial: GET balance equals sum from GET compras (usuario)', async () => {
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
      montoDeudor: 30,
      estado: 'aceptado',
    });
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 20,
      estado: 'pago_pendiente',
    });

    const historialRes = await request(app)
      .get(`${BASE}?usuario=${userB._id}&limit=100`)
      .set(authHeaders(userA));
    expect(historialRes.status).toBe(200);
    const compras = historialRes.body.data as any[];

    const estadosQueCuentan = ['aceptado', 'pago_pendiente'];
    let totalACobrar = 0;
    let totalAPagar = 0;
    for (const c of compras) {
      if (!estadosQueCuentan.includes(c.estado)) continue;
      const acreedorId = c.acreedorId?._id ?? c.acreedorId;
      const deudorId = c.deudorId?._id ?? c.deudorId;
      const aid = typeof acreedorId === 'string' ? acreedorId : acreedorId?.toString?.();
      const did = typeof deudorId === 'string' ? deudorId : deudorId?.toString?.();
      if (aid === userA._id && did === userB._id) {
        totalACobrar += c.montoAcreedor ?? c.montoDeudor ?? 0;
      } else if (aid === userB._id && did === userA._id) {
        totalAPagar += c.montoDeudor ?? 0;
      }
    }
    const expectedBalance = totalACobrar - totalAPagar;

    const balanceRes = await request(app)
      .get(`${BASE}/balance/${userB._id}`)
      .set(authHeaders(userA));
    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.data.balance).toBe(expectedBalance);
    expect(balanceRes.body.data.totalACobrar).toBe(totalACobrar);
    expect(balanceRes.body.data.totalAPagar).toBe(totalAPagar);
  });

  it('returns 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).get(`${BASE}/balance/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /compras/balances', () => {
  it('returns all bilateral balances for roommates', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await makeFriends(userA._id, userB._id);
    const tipoId = await getDefaultTipoId();
    await createCompra({
      acreedorId: userA._id,
      deudorId: userB._id,
      tipoId,
      montoDeudor: 25,
      estado: 'aceptado',
    });

    const res = await request(app)
      .get(`${BASE}/balances`)
      .set(authHeaders(userA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const withB = res.body.data.find((b: any) => b.roommateId === userB._id);
    expect(withB).toBeDefined();
    expect(withB.balance).toBe(25);
    expect(withB.estado).toBe('te deben');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/balances`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /compras/:id (update)', () => {
  it('allows the creditor to update a pending expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}`)
      .set(authHeaders(creditor))
      .send({ descripcion: 'Updated description' });
    expect(res.status).toBe(200);
    expect(res.body.data.descripcion).toBe('Updated description');
  });

  it('returns 403 when the debtor tries to update', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}`)
      .set(authHeaders(debtor))
      .send({ descripcion: 'Hacking' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when trying to update an accepted expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}`)
      .set(authHeaders(creditor))
      .send({ descripcion: 'Updated' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /compras/:id/accept', () => {
  it('allows the debtor to accept a pending expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/accept`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('aceptado');
  });

  it('returns 404 when the creditor tries to accept', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/accept`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(404);
  });

  it('returns 400 when expense is not pending', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/accept`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /compras/:id/reject', () => {
  it('allows the debtor to reject a pending expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/reject`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('rechazado');
  });

  it('returns 400 when expense is not pending', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/reject`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(400);
  });
});

describe('Payment flow: request-payment → confirm-payment / reject-payment', () => {
  it('full payment flow: accept → request-payment → confirm-payment', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });
    const id = compra._id.toString();

    await request(app).patch(`${BASE}/${id}/accept`).set(authHeaders(debtor));

    const reqPayRes = await request(app).patch(`${BASE}/${id}/request-payment`).set(authHeaders(debtor));
    expect(reqPayRes.status).toBe(200);
    expect(reqPayRes.body.data.estado).toBe('pago_pendiente');

    const confirmRes = await request(app).patch(`${BASE}/${id}/confirm-payment`).set(authHeaders(creditor));
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.estado).toBe('pagado');
  });

  it('creditor can reject a payment request (back to aceptado)', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pago_pendiente' });
    const id = compra._id.toString();

    const res = await request(app).patch(`${BASE}/${id}/reject-payment`).set(authHeaders(creditor));
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('aceptado');
  });

  it('returns 400 when request-payment on a non-aceptado expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'pendiente' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/request-payment`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(400);
  });

  it('returns 400 when confirm-payment on a non-pago_pendiente expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/confirm-payment`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(400);
  });

  it('returns 400 when reject-payment on non-pago_pendiente expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId, estado: 'aceptado' });

    const res = await request(app)
      .patch(`${BASE}/${compra._id}/reject-payment`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /compras/:id', () => {
  it('allows the creditor to delete a pending expense', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId });

    const res = await request(app)
      .delete(`${BASE}/${compra._id}`)
      .set(authHeaders(creditor));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const deleted = await ComprasModel.findById(compra._id);
    expect(deleted).toBeNull();
  });

  it('returns 403 when the debtor tries to delete', async () => {
    const creditor = await createTestUser();
    const debtor = await createTestUser();
    await makeFriends(creditor._id, debtor._id);
    const tipoId = await getDefaultTipoId();
    const compra = await createCompra({ acreedorId: creditor._id, deudorId: debtor._id, tipoId });

    const res = await request(app)
      .delete(`${BASE}/${compra._id}`)
      .set(authHeaders(debtor));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent expense', async () => {
    const user = await createTestUser();
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).delete(`${BASE}/${fakeId}`).set(authHeaders(user));
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).delete(`${BASE}/${fakeId}`);
    expect(res.status).toBe(401);
  });
});
