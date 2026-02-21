import { describe, it, expect } from 'vitest';
import { Types } from 'mongoose';
import { UsuarioModel } from '../../modules/usuarios/usuario.model.ts';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  areFriends,
  getFriendStatus,
  getFriends,
} from '../../modules/friends/friends.services.ts';
import { FriendshipModel } from '../../modules/friends/friends.model.ts';
import { makeFriends } from '../helpers/db.helpers.ts';

function expectError(err: unknown, statusCode: number) {
  expect(err).toMatchObject({ statusCode });
}

async function createUser(suffix: string) {
  const unique = `${Date.now()}_${suffix}`;
  return UsuarioModel.create({
    username: `user_${unique}`,
    email: `user_${unique}@example.com`,
    password: 'pass12345',
  });
}

describe('sendFriendRequest', () => {
  it('creates a pending friend request', async () => {
    const a = await createUser('req_a');
    const b = await createUser('req_b');
    const result = await sendFriendRequest(a._id.toString(), b._id.toString());
    expect(result.status).toBe('pending');
  });

  it('throws 400 when sending request to self', async () => {
    const a = await createUser('self');
    const err = await sendFriendRequest(a._id.toString(), a._id.toString()).catch(e => e);
    expectError(err, 400);
  });

  it('throws 409 when request already sent', async () => {
    const a = await createUser('dup_a');
    const b = await createUser('dup_b');
    await sendFriendRequest(a._id.toString(), b._id.toString());
    const err = await sendFriendRequest(a._id.toString(), b._id.toString()).catch(e => e);
    expectError(err, 409);
  });

  it('throws 409 when already friends', async () => {
    const a = await createUser('friends_a');
    const b = await createUser('friends_b');
    await makeFriends(a._id.toString(), b._id.toString());
    const err = await sendFriendRequest(a._id.toString(), b._id.toString()).catch(e => e);
    expectError(err, 409);
  });

  it('throws 404 for non-existent addressee', async () => {
    const a = await createUser('noaddr');
    const fakeId = new Types.ObjectId().toString();
    const err = await sendFriendRequest(a._id.toString(), fakeId).catch(e => e);
    expectError(err, 404);
  });

  it('reactivates a rejected request as a new pending request', async () => {
    const a = await createUser('rej_a');
    const b = await createUser('rej_b');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    await FriendshipModel.findByIdAndUpdate(req._id, { status: 'rejected' });
    const result = await sendFriendRequest(a._id.toString(), b._id.toString());
    expect(result.status).toBe('pending');
  });
});

describe('acceptFriendRequest', () => {
  it('accepts a pending friend request', async () => {
    const a = await createUser('accept_a');
    const b = await createUser('accept_b');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    const result = await acceptFriendRequest(req._id.toString(), b._id.toString());
    expect(result.status).toBe('accepted');
  });

  it('throws 403 if a non-addressee tries to accept', async () => {
    const a = await createUser('acc_forbidden_a');
    const b = await createUser('acc_forbidden_b');
    const c = await createUser('acc_forbidden_c');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    const err = await acceptFriendRequest(req._id.toString(), c._id.toString()).catch(e => e);
    expectError(err, 403);
  });

  it('throws 400 if request is already processed', async () => {
    const a = await createUser('acc_proc_a');
    const b = await createUser('acc_proc_b');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    await acceptFriendRequest(req._id.toString(), b._id.toString());
    const err = await acceptFriendRequest(req._id.toString(), b._id.toString()).catch(e => e);
    expectError(err, 400);
  });

  it('throws 404 for non-existent request', async () => {
    const b = await createUser('acc_notfound');
    const fakeId = new Types.ObjectId().toString();
    const err = await acceptFriendRequest(fakeId, b._id.toString()).catch(e => e);
    expectError(err, 404);
  });
});

describe('rejectFriendRequest', () => {
  it('rejects a pending friend request', async () => {
    const a = await createUser('rej_req_a');
    const b = await createUser('rej_req_b');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    const result = await rejectFriendRequest(req._id.toString(), b._id.toString());
    expect(result.status).toBe('rejected');
  });

  it('throws 403 if non-addressee tries to reject', async () => {
    const a = await createUser('rej_forb_a');
    const b = await createUser('rej_forb_b');
    const c = await createUser('rej_forb_c');
    const req = await sendFriendRequest(a._id.toString(), b._id.toString());
    const err = await rejectFriendRequest(req._id.toString(), c._id.toString()).catch(e => e);
    expectError(err, 403);
  });
});

describe('removeFriend', () => {
  it('removes an existing friendship', async () => {
    const a = await createUser('rem_a');
    const b = await createUser('rem_b');
    await makeFriends(a._id.toString(), b._id.toString());
    await removeFriend(a._id.toString(), b._id.toString());
    const still = await areFriends(a._id.toString(), b._id.toString());
    expect(still).toBe(false);
  });

  it('throws 404 if they are not friends', async () => {
    const a = await createUser('notfriend_a');
    const b = await createUser('notfriend_b');
    const err = await removeFriend(a._id.toString(), b._id.toString()).catch(e => e);
    expectError(err, 404);
  });
});

describe('searchUsers', () => {
  it('returns users matching the query', async () => {
    const searcher = await createUser('searcher');
    await UsuarioModel.create({
      username: 'findme_unique_xyz',
      email: 'findme@example.com',
      password: 'pass12345',
    });
    const results = await searchUsers('findme_unique_xyz', searcher._id.toString());
    expect(results.some((u: any) => u.username === 'findme_unique_xyz')).toBe(true);
  });

  it('excludes friends from results', async () => {
    const a = await createUser('excl_a');
    const b = await UsuarioModel.create({
      username: 'excludeduser_zzz',
      email: 'excluded@example.com',
      password: 'pass12345',
    });
    await makeFriends(a._id.toString(), b._id.toString());
    const results = await searchUsers('excludeduser_zzz', a._id.toString());
    expect(results.some((u: any) => u.username === 'excludeduser_zzz')).toBe(false);
  });

  it('excludes self from results', async () => {
    const a = await createUser('selfexclude');
    const results = await searchUsers(a.username, a._id.toString());
    expect(results.some((u: any) => u._id?.toString() === a._id.toString())).toBe(false);
  });

  it('returns empty array for query shorter than 2 characters', async () => {
    const a = await createUser('shortquery');
    const results = await searchUsers('a', a._id.toString());
    expect(results).toEqual([]);
  });

  it('filters by username only when @ prefix is used', async () => {
    const a = await createUser('atprefix');
    await UsuarioModel.create({
      username: 'specialusername',
      email: 'specialusername@example.com',
      password: 'pass12345',
    });
    const results = await searchUsers('@specialusername', a._id.toString());
    expect(results.some((u: any) => u.username === 'specialusername')).toBe(true);
  });
});

describe('areFriends', () => {
  it('returns true for accepted friendship', async () => {
    const a = await createUser('areFriends_a');
    const b = await createUser('areFriends_b');
    await makeFriends(a._id.toString(), b._id.toString());
    expect(await areFriends(a._id.toString(), b._id.toString())).toBe(true);
  });

  it('returns false for users who are not friends', async () => {
    const a = await createUser('notfriends_a');
    const b = await createUser('notfriends_b');
    expect(await areFriends(a._id.toString(), b._id.toString())).toBe(false);
  });
});

describe('getFriendStatus', () => {
  it('returns "self" when both IDs are the same', async () => {
    const a = await createUser('status_self');
    const result = await getFriendStatus(a._id.toString(), a._id.toString());
    expect(result.status).toBe('self');
  });

  it('returns "friend" for accepted friendship', async () => {
    const a = await createUser('status_friend_a');
    const b = await createUser('status_friend_b');
    await makeFriends(a._id.toString(), b._id.toString());
    const result = await getFriendStatus(a._id.toString(), b._id.toString());
    expect(result.status).toBe('friend');
  });

  it('returns "pending_sent" when current user sent the request', async () => {
    const a = await createUser('status_sent_a');
    const b = await createUser('status_sent_b');
    await sendFriendRequest(a._id.toString(), b._id.toString());
    const result = await getFriendStatus(a._id.toString(), b._id.toString());
    expect(result.status).toBe('pending_sent');
  });

  it('returns "pending_received" when the other user sent the request', async () => {
    const a = await createUser('status_recv_a');
    const b = await createUser('status_recv_b');
    await sendFriendRequest(a._id.toString(), b._id.toString());
    const result = await getFriendStatus(b._id.toString(), a._id.toString());
    expect(result.status).toBe('pending_received');
    expect(result.requestId).toBeDefined();
  });

  it('returns "none" for strangers', async () => {
    const a = await createUser('status_none_a');
    const b = await createUser('status_none_b');
    const result = await getFriendStatus(a._id.toString(), b._id.toString());
    expect(result.status).toBe('none');
  });
});

describe('getFriends', () => {
  it('returns list of accepted friends', async () => {
    const a = await createUser('gf_a');
    const b = await createUser('gf_b');
    await makeFriends(a._id.toString(), b._id.toString());
    const friends = await getFriends(a._id.toString());
    expect(friends.some((f: any) => f.id === b._id.toString())).toBe(true);
  });

  it('returns empty array when user has no friends', async () => {
    const a = await createUser('gf_lonely');
    const friends = await getFriends(a._id.toString());
    expect(friends).toEqual([]);
  });
});
