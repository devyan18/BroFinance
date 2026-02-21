import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { createTestApp } from '../createTestApp.ts';
import { createTestUser, authHeaders } from '../helpers/auth.helpers.ts';
import { makeFriends } from '../helpers/db.helpers.ts';
import { FriendshipModel } from '../../modules/friends/friends.model.ts';

const app = createTestApp();
const BASE = '/api/v1/friends';

describe('GET /friends', () => {
  it('returns empty list when user has no friends', async () => {
    const user = await createTestUser();
    const res = await request(app).get(BASE).set(authHeaders(user));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns list of accepted friends', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const res = await request(app).get(BASE).set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.some((f: any) => f.id === b._id)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });
});

describe('GET /friends/requests', () => {
  it('returns sent and received pending requests', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'pending',
    });
    const res = await request(app).get(`${BASE}/requests`).set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBeDefined();
    expect(res.body.data.received).toBeDefined();
    expect(res.body.data.sent.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/requests`);
    expect(res.status).toBe(401);
  });
});

describe('GET /friends/status/:userId', () => {
  it('returns "none" for strangers', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const res = await request(app).get(`${BASE}/status/${b._id}`).set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('none');
  });

  it('returns "friend" for accepted friendship', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const res = await request(app).get(`${BASE}/status/${b._id}`).set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('friend');
  });

  it('returns 401 without auth', async () => {
    const b = await createTestUser();
    const res = await request(app).get(`${BASE}/status/${b._id}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /friends/search', () => {
  it('returns users matching the query', async () => {
    const searcher = await createTestUser();
    const target = await createTestUser({ username: 'uniquesearchable99' });
    const res = await request(app)
      .get(`${BASE}/search?q=uniquesearchable99`)
      .set(authHeaders(searcher));
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: any) => u.username === target.username)).toBe(true);
  });

  it('excludes already-friends from results', async () => {
    const a = await createTestUser();
    const b = await createTestUser({ username: 'excludethisfriend99' });
    await makeFriends(a._id, b._id);
    const res = await request(app)
      .get(`${BASE}/search?q=excludethisfriend99`)
      .set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: any) => u.username === b.username)).toBe(false);
  });

  it('returns 400 when q param is missing', async () => {
    const user = await createTestUser();
    const res = await request(app).get(`${BASE}/search`).set(authHeaders(user));
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${BASE}/search?q=test`);
    expect(res.status).toBe(401);
  });
});

describe('POST /friends/request', () => {
  it('sends a friend request successfully', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/request`)
      .set(authHeaders(a))
      .send({ userId: b._id });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for self-request', async () => {
    const a = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/request`)
      .set(authHeaders(a))
      .send({ userId: a._id });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate request', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await request(app).post(`${BASE}/request`).set(authHeaders(a)).send({ userId: b._id });
    const res = await request(app)
      .post(`${BASE}/request`)
      .set(authHeaders(a))
      .send({ userId: b._id });
    expect(res.status).toBe(409);
  });

  it('returns 409 when already friends', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const res = await request(app)
      .post(`${BASE}/request`)
      .set(authHeaders(a))
      .send({ userId: b._id });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid userId format', async () => {
    const a = await createTestUser();
    const res = await request(app)
      .post(`${BASE}/request`)
      .set(authHeaders(a))
      .send({ userId: 'not-an-objectid' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const b = await createTestUser();
    const res = await request(app).post(`${BASE}/request`).send({ userId: b._id });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /friends/requests/:id/accept', () => {
  it('accepts a friend request', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const friendship = await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'pending',
    });
    const res = await request(app)
      .patch(`${BASE}/requests/${friendship._id}/accept`)
      .set(authHeaders(b));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when non-addressee tries to accept', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const c = await createTestUser();
    const friendship = await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'pending',
    });
    const res = await request(app)
      .patch(`${BASE}/requests/${friendship._id}/accept`)
      .set(authHeaders(c));
    expect(res.status).toBe(403);
  });

  it('returns 400 for already-processed request', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const friendship = await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'accepted',
    });
    const res = await request(app)
      .patch(`${BASE}/requests/${friendship._id}/accept`)
      .set(authHeaders(b));
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).patch(`${BASE}/requests/${fakeId}/accept`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /friends/requests/:id/reject', () => {
  it('rejects a friend request', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const friendship = await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'pending',
    });
    const res = await request(app)
      .patch(`${BASE}/requests/${friendship._id}/reject`)
      .set(authHeaders(b));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when non-addressee tries to reject', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const c = await createTestUser();
    const friendship = await FriendshipModel.create({
      requesterId: new Types.ObjectId(a._id),
      addresseeId: new Types.ObjectId(b._id),
      status: 'pending',
    });
    const res = await request(app)
      .patch(`${BASE}/requests/${friendship._id}/reject`)
      .set(authHeaders(c));
    expect(res.status).toBe(403);
  });

  it('returns 401 without auth', async () => {
    const fakeId = new Types.ObjectId().toString();
    const res = await request(app).patch(`${BASE}/requests/${fakeId}/reject`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /friends/:userId', () => {
  it('removes a friendship', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await makeFriends(a._id, b._id);
    const res = await request(app)
      .delete(`${BASE}/${b._id}`)
      .set(authHeaders(a));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when not friends', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const res = await request(app)
      .delete(`${BASE}/${b._id}`)
      .set(authHeaders(a));
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const b = await createTestUser();
    const res = await request(app).delete(`${BASE}/${b._id}`);
    expect(res.status).toBe(401);
  });
});
