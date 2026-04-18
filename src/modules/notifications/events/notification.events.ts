export const NOTIFICATION_EVENTS = {
  USER_FOLLOWED: 'user.followed',
  POST_LIKED: 'post.liked',
  POST_COMMENTED: 'post.commented',
  POST_CREATED: 'post.created',
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
