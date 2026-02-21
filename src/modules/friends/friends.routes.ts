/**
 * Friends routes
 * API endpoints for friend requests and friendships
 */

import { Router } from 'express';
import { FriendsController } from './friends.controllers.ts';
import { validateData } from '../middlewares/validateRoute.ts';
import {
  sendRequestSchema,
  acceptRejectRequestSchema,
  removeFriendSchema,
  searchUsersSchema,
  getStatusSchema,
} from './friends.route.validations.ts';
import { asyncHandler } from '../../middlewares/errorHandler.ts';
import { authenticate } from '../../middlewares/authenticate.ts';

const friendsRouter = Router();

friendsRouter.get('/friends', authenticate, asyncHandler(FriendsController.listFriends));
friendsRouter.get('/friends/requests', authenticate, asyncHandler(FriendsController.listRequests));
friendsRouter.get(
  '/friends/status/:userId',
  authenticate,
  validateData(getStatusSchema),
  asyncHandler(FriendsController.getStatus),
);
friendsRouter.get(
  '/friends/search',
  authenticate,
  validateData(searchUsersSchema),
  asyncHandler(FriendsController.search),
);
friendsRouter.post(
  '/friends/request',
  authenticate,
  validateData(sendRequestSchema),
  asyncHandler(FriendsController.sendRequest),
);
friendsRouter.patch(
  '/friends/requests/:id/accept',
  authenticate,
  validateData(acceptRejectRequestSchema),
  asyncHandler(FriendsController.acceptRequest),
);
friendsRouter.patch(
  '/friends/requests/:id/reject',
  authenticate,
  validateData(acceptRejectRequestSchema),
  asyncHandler(FriendsController.rejectRequest),
);
friendsRouter.delete(
  '/friends/:userId',
  authenticate,
  validateData(removeFriendSchema),
  asyncHandler(FriendsController.removeFriend),
);

export { friendsRouter };
