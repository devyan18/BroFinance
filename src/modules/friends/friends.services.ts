/**
 * Friends services
 * Business logic for friend requests and friendships
 */

import { Types } from 'mongoose';
import { FriendshipModel } from './friends.model.ts';
import { UsuarioModel } from '../usuarios/usuario.model.ts';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../../utils/errors.ts';

export async function getFriends(userId: string) {
  const friendships = await FriendshipModel.find({
    $or: [
      { requesterId: new Types.ObjectId(userId), status: 'accepted' },
      { addresseeId: new Types.ObjectId(userId), status: 'accepted' },
    ],
  })
    .populate('requesterId', 'username avatarUrl email')
    .populate('addresseeId', 'username avatarUrl email');

  const friendIds = friendships.map((f) => {
    const r = (f.requesterId as { _id: Types.ObjectId })._id?.toString?.();
    const a = (f.addresseeId as { _id: Types.ObjectId })._id?.toString?.();
    return r === userId ? a : r;
  });

  const friends = await UsuarioModel.find({ _id: { $in: friendIds } })
    .select('username avatarUrl email')
    .sort({ username: 1 });

  return friends.map((u) => ({
    id: u._id.toString(),
    username: u.username,
    avatarUrl: u.avatarUrl,
    email: u.email,
  }));
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const friends = await getFriends(userId);
  return friends.map((f) => f.id);
}

export async function getPendingRequests(userId: string) {
  const sent = await FriendshipModel.find({
    requesterId: new Types.ObjectId(userId),
    status: 'pending',
  })
    .populate('addresseeId', 'username avatarUrl')
    .sort({ createdAt: -1 });

  const received = await FriendshipModel.find({
    addresseeId: new Types.ObjectId(userId),
    status: 'pending',
  })
    .populate('requesterId', 'username avatarUrl')
    .sort({ createdAt: -1 });

  const toUser = (doc: unknown) => {
    const d = doc as { _id?: { toString: () => string }; username?: string; avatarUrl?: string };
    return {
      _id: d._id?.toString?.() ?? '',
      username: d.username ?? '',
      avatarUrl: d.avatarUrl,
    };
  };
  return {
    sent: sent.map((f) => ({
      id: f._id,
      user: toUser(f.addresseeId),
      createdAt: (f as { createdAt?: Date }).createdAt,
    })),
    received: received.map((f) => ({
      id: f._id,
      user: toUser(f.requesterId),
      createdAt: (f as { createdAt?: Date }).createdAt,
    })),
  };
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  if (requesterId === addresseeId) {
    throw new BadRequestError('No puedes enviarte una solicitud a ti mismo');
  }

  const addressee = await UsuarioModel.findById(addresseeId);
  if (!addressee) {
    throw new NotFoundError('Usuario no encontrado');
  }

  const existing = await FriendshipModel.findOne({
    $or: [
      { requesterId: new Types.ObjectId(requesterId), addresseeId: new Types.ObjectId(addresseeId) },
      { requesterId: new Types.ObjectId(addresseeId), addresseeId: new Types.ObjectId(requesterId) },
    ],
  });

  if (existing) {
    if (existing.status === 'accepted') {
      throw new ConflictError('Ya son amigos');
    }
    if (existing.status === 'pending') {
      if ((existing.requesterId as Types.ObjectId).toString() === requesterId) {
        throw new ConflictError('Ya enviaste una solicitud a este usuario');
      }
      throw new ConflictError('Este usuario ya te envió una solicitud. Acéptala desde Amigos.');
    }
    // rejected: reactivate as new request from current user
    existing.requesterId = new Types.ObjectId(requesterId);
    existing.addresseeId = new Types.ObjectId(addresseeId);
    existing.status = 'pending';
    await existing.save();
    return existing;
  }

  const friendship = await FriendshipModel.create({
    requesterId: new Types.ObjectId(requesterId),
    addresseeId: new Types.ObjectId(addresseeId),
    status: 'pending',
  });
  return friendship;
}

export async function acceptFriendRequest(requestId: string, userId: string) {
  const friendship = await FriendshipModel.findById(requestId);
  if (!friendship) {
    throw new NotFoundError('Solicitud no encontrada');
  }

  const addresseeId = (friendship.addresseeId as Types.ObjectId).toString();
  if (addresseeId !== userId) {
    throw new ForbiddenError('No puedes aceptar esta solicitud');
  }

  if (friendship.status !== 'pending') {
    throw new BadRequestError('Esta solicitud ya fue procesada');
  }

  friendship.status = 'accepted';
  await friendship.save();
  return friendship;
}

export async function rejectFriendRequest(requestId: string, userId: string) {
  const friendship = await FriendshipModel.findById(requestId);
  if (!friendship) {
    throw new NotFoundError('Solicitud no encontrada');
  }

  const addresseeId = (friendship.addresseeId as Types.ObjectId).toString();
  if (addresseeId !== userId) {
    throw new ForbiddenError('No puedes rechazar esta solicitud');
  }

  friendship.status = 'rejected';
  await friendship.save();
  return friendship;
}

export async function removeFriend(userId: string, friendId: string) {
  const friendship = await FriendshipModel.findOne({
    status: 'accepted',
    $or: [
      { requesterId: userId, addresseeId: friendId },
      { requesterId: friendId, addresseeId: userId },
    ],
  });

  if (!friendship) {
    throw new NotFoundError('No existe amistad con este usuario');
  }

  await FriendshipModel.findByIdAndDelete(friendship._id);
}

export async function searchUsers(query: string, currentUserId: string, limit = 20) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  // If query starts with '@', strip it and search only by username
  const isUsernameSearch = trimmed.startsWith('@');
  const searchTerm = isUsernameSearch ? trimmed.slice(1) : trimmed;

  if (searchTerm.length < 1) return [];

  // Escape special regex characters to prevent errors and injection
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const friendsResult = await getFriends(currentUserId);
  const friendIds = friendsResult.map((f) => f.id);

  const pending = await FriendshipModel.find({
    $or: [
      { requesterId: new Types.ObjectId(currentUserId), status: 'pending' },
      { addresseeId: new Types.ObjectId(currentUserId), status: 'pending' },
    ],
  });
  const pendingIds = new Set<string>();
  pending.forEach((p) => {
    const r = (p.requesterId as Types.ObjectId).toString();
    const a = (p.addresseeId as Types.ObjectId).toString();
    if (r !== currentUserId) pendingIds.add(r);
    if (a !== currentUserId) pendingIds.add(a);
  });

  const excludeIds = [currentUserId, ...friendIds, ...Array.from(pendingIds)];

  // When '@' prefix is used, search only by username; otherwise search username + email
  const searchConditions = isUsernameSearch
    ? [{ username: { $regex: escaped, $options: 'i' } }]
    : [
        { username: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];

  const users = await UsuarioModel.find({
    _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
    $or: searchConditions,
  })
    .select('username avatarUrl email')
    .limit(limit)
    .sort({ username: 1 });

  return users.map((u) => ({
    id: u._id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    email: u.email ? `${u.email.slice(0, 3)}***@${u.email.split('@')[1] || '***'}` : undefined,
  }));
}

export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const f = await FriendshipModel.findOne({
    status: 'accepted',
    $or: [
      { requesterId: new Types.ObjectId(userIdA), addresseeId: new Types.ObjectId(userIdB) },
      { requesterId: new Types.ObjectId(userIdB), addresseeId: new Types.ObjectId(userIdA) },
    ],
  });
  return !!f;
}

export type FriendStatus = 'self' | 'friend' | 'pending_sent' | 'pending_received' | 'none';

export async function getFriendStatus(
  currentUserId: string,
  targetUserId: string,
): Promise<{ status: FriendStatus; requestId?: string }> {
  if (currentUserId === targetUserId) return { status: 'self' };

  const friendship = await FriendshipModel.findOne({
    $or: [
      { requesterId: new Types.ObjectId(currentUserId), addresseeId: new Types.ObjectId(targetUserId) },
      { requesterId: new Types.ObjectId(targetUserId), addresseeId: new Types.ObjectId(currentUserId) },
    ],
  });

  if (!friendship) return { status: 'none' };
  if (friendship.status === 'accepted') return { status: 'friend' };
  if (friendship.status === 'pending') {
    const iAmRequester = (friendship.requesterId as Types.ObjectId).toString() === currentUserId;
    return {
      status: iAmRequester ? 'pending_sent' : 'pending_received',
      requestId: friendship._id.toString(),
    };
  }
  return { status: 'none' };
}
