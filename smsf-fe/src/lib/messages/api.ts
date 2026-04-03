import { api } from '@/lib/auth/api';
import { IDirectMessage, IFriend, IConversation, IFriendListItem, IFriendRequest } from '@/types/messages';

interface IApiResponse<T> {
    data?: T;
    message?: string;
}

export async function sendMessageRequest(receiverId: string, content: string): Promise<IDirectMessage> {
    const response = await api.post<IApiResponse<IDirectMessage>>('/messages/send', {
        receiverId,
        content,
    });
    return response.data.data!;
}

export async function getMessagesRequest(friendId: string, limit = 50, offset = 0): Promise<IDirectMessage[]> {
    const response = await api.get<IApiResponse<IDirectMessage[]>>(
        `/messages/${friendId}?limit=${limit}&offset=${offset}`
    );
    return response.data.data || [];
}

export async function getConversationsRequest(): Promise<IConversation[]> {
    const response = await api.get<IApiResponse<IConversation[]>>('/messages/list-conversations');
    return response.data.data || [];
}

export async function searchFriendsRequest(keyword: string): Promise<IFriend[]> {
    const response = await api.get<IApiResponse<IFriend[]>>(
        `/messages/search/friends?keyword=${encodeURIComponent(keyword)}`
    );
    return response.data.data || [];
}

export async function sendFriendRequestRequest(friendId: string): Promise<{ id: string; senderId: string; receiverId: string; status: string; createdAt: number }> {
    const response = await api.post<IApiResponse<{ id: string; senderId: string; receiverId: string; status: string; createdAt: number }>>('/messages/friend-request/send', {
        friendId,
    });
    return response.data.data!;
}

export async function acceptFriendRequestRequest(requestId: string): Promise<{ message: string }> {
    const response = await api.post<IApiResponse<{ message: string }>>('/messages/friend-request/accept', {
        requestId,
    });
    return response.data.data!;
}

export async function rejectFriendRequestRequest(requestId: string): Promise<{ message: string }> {
    const response = await api.post<IApiResponse<{ message: string }>>('/messages/friend-request/reject', {
        requestId,
    });
    return response.data.data!;
}

export async function getPendingFriendRequestsRequest(): Promise<IFriendRequest[]> {
    const response = await api.get<IApiResponse<IFriendRequest[]>>('/messages/friend-request/pending');
    return response.data.data || [];
}

export async function getFriendsRequest(): Promise<IFriendListItem[]> {
    const response = await api.get<IApiResponse<IFriendListItem[]>>('/messages/friends');
    return response.data.data || [];
}
