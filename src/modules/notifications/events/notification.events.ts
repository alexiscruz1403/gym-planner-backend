export const NOTIFICATION_EVENTS = {
  USER_FOLLOWED: 'user.followed',
  POST_LIKED: 'post.liked',
  POST_COMMENTED: 'post.commented',
  POST_CREATED: 'post.created',
  FOLLOW_REQUEST_SENT: 'follow_request.sent',
  FOLLOW_REQUEST_ACCEPTED: 'follow_request.accepted',
} as const;

export class UserFollowedEvent {
  constructor(
    public readonly actorId: string,
    public readonly recipientId: string,
  ) {}
}

export class PostLikedEvent {
  constructor(
    public readonly actorId: string,
    public readonly postOwnerId: string,
    public readonly postId: string,
  ) {}
}

export class PostCommentedEvent {
  constructor(
    public readonly actorId: string,
    public readonly postOwnerId: string,
    public readonly postId: string,
    public readonly commentText: string,
  ) {}
}

export class PostCreatedEvent {
  constructor(
    public readonly actorId: string,
    public readonly postId: string,
  ) {}
}

export class FollowRequestSentEvent {
  constructor(
    public readonly senderId: string,
    public readonly recipientId: string,
  ) {}
}

export class FollowRequestAcceptedEvent {
  constructor(
    public readonly senderId: string,
    public readonly recipientId: string,
  ) {}
}
