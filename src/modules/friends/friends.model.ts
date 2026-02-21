/**
 * Friendship model
 * Manages friend requests and accepted friendships
 */

import { Schema, model, Document, Types } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface IFriendship extends Document {
  requesterId: Types.ObjectId;
  addresseeId: Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    addresseeId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One friendship record per pair (requester+addressee), prevent duplicates
FriendshipSchema.index({ requesterId: 1, addresseeId: 1 }, { unique: true });

export const FriendshipModel = model<IFriendship>('Friendship', FriendshipSchema);
