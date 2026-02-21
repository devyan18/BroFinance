/**
 * Friends controllers
 * Handles HTTP requests for friend requests and friendships
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/index.ts';
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  getFriendStatus,
} from './friends.services.ts';
import { asyncHandler } from '../../middlewares/errorHandler.ts';

export class FriendsController {
  static async listFriends(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const friends = await getFriends(req.user.userId);
    res.status(200).json({ success: true, data: friends });
  }

  static async listRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const requests = await getPendingRequests(req.user.userId);
    res.status(200).json({ success: true, data: requests });
  }

  static async search(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const validated = (req as AuthenticatedRequest & { validatedQuery?: { q: string; limit?: number } }).validatedQuery;
    const { q, limit } = (validated ?? req.query) as { q: string; limit?: number };
    const users = await searchUsers(q, req.user.userId, limit);
    res.status(200).json({ success: true, data: users });
  }

  static async sendRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const { userId } = req.body;
    await sendFriendRequest(req.user.userId, userId);
    res.status(201).json({ success: true, message: 'Solicitud enviada' });
  }

  static async acceptRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const { id } = req.params;
    await acceptFriendRequest(id, req.user.userId);
    res.status(200).json({ success: true, message: 'Solicitud aceptada' });
  }

  static async rejectRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const { id } = req.params;
    await rejectFriendRequest(id, req.user.userId);
    res.status(200).json({ success: true, message: 'Solicitud rechazada' });
  }

  static async removeFriend(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const { userId: friendId } = req.params;
    await removeFriend(req.user.userId, friendId);
    res.status(200).json({ success: true, message: 'Amigo eliminado' });
  }

  static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(404).json({ success: false, error: 'Usuario no sincronizado', code: 'USER_NOT_SYNCED' });
      return;
    }
    const { userId: targetUserId } = req.params;
    const result = await getFriendStatus(req.user.userId, targetUserId);
    res.status(200).json({ success: true, data: result });
  }
}
