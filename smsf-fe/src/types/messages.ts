export interface IDirectMessage {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    isRead: boolean;
    createdAt: number;
}

export interface IFriend {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isFriend: boolean;
    hasRequest: boolean;
    requestDirection: 'incoming' | 'outgoing' | null;
}

export interface IConversation {
    friendId: string;
    friendName: string;
    friendUsername: string;
    friendAvatarUrl: string | null;
    lastMessage: string;
    lastMessageTime: number;
    unreadCount: number;
}

export interface IFriendRequest {
    requestId: string;
    senderId: string;
    senderName: string;
    senderUsername: string;
    senderAvatarUrl: string | null;
    createdAt: number;
}

export interface IFriendListItem {
    friendId: string;
    friendName: string;
    friendUsername: string;
    friendAvatarUrl: string | null;
    createdAt: number;
}
