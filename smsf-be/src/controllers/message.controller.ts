import { Request, Response } from "express";
import {
    sendDirectMessage,
    getDirectMessages,
    markMessagesAsRead,
    getConversationList,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getPendingFriendRequests,
    searchFriends,
    getFriendsList,
} from "../services/message.service";
import { IApiResponse } from "../interfaces/common.interface";
import { emitToUser } from "../lib/socket";
import { prisma } from "../lib/prisma";

interface IAuthRequest extends Request {
    user?: { id: string };
}

const publicUserSelect = {
    id: true,
    displayName: true,
    username: true,
    avatarUrl: true,
};

const toMessagePayload = (message: {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    isRead: boolean;
    createdAt: bigint | number;
}) => ({
    id: message.id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    content: message.content,
    isRead: message.isRead,
    createdAt: Number(message.createdAt),
});

async function getPublicUsers(userIds: string[]) {
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: publicUserSelect,
    });

    return new Map(users.map((user) => [user.id, user]));
}

function toFriendPayload(user: {
    id: string;
    displayName: string | null;
    username: string;
    avatarUrl: string | null;
}) {
    return {
        friendId: user.id,
        friendName: user.displayName || user.username,
        friendUsername: user.username,
        friendAvatarUrl: user.avatarUrl,
        createdAt: Date.now(),
    };
}

export async function sendMessage(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { receiverId, content } = req.body as { receiverId: string; content: string };

        if (!receiverId || !content) {
            return res.status(400).json({ message: "Receiveri ID và nội dung là bắt buộc" });
        }

        const message = await sendDirectMessage(userId, receiverId, content);
        const payload = toMessagePayload(message);

        emitToUser(userId, "message_sent", payload);
        emitToUser(receiverId, "message_received", payload);

        return res.json({
            data: payload,
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Gửi tin nhắn thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function getMessages(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { friendId } = req.params as { friendId: string };
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
        const offset = parseInt(req.query.offset as string) || 0;

        if (!friendId) {
            return res.status(400).json({ message: "Friend ID là bắt buộc" });
        }

        const messages = await getDirectMessages(userId, friendId, limit, offset);

        // Mark as read
        const markedCount = await markMessagesAsRead(userId, friendId);

        if (markedCount > 0) {
            emitToUser(friendId, "messages_read", {
                readBy: userId,
                reader: userId,
            });
        }

        return res.json({
            data: messages.map((msg) => toMessagePayload(msg)),
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Lấy tin nhắn thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function listConversations(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const conversations = await getConversationList(userId);

        return res.json({
            data: conversations,
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Lấy danh sách cuộc trò chuyện thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function createFriendRequest(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { friendId } = req.body as { friendId: string };

        if (!friendId) {
            return res.status(400).json({ message: "Friend ID là bắt buộc" });
        }

        const request = await sendFriendRequest(userId, friendId);

        const sender = await prisma.user.findUnique({
            where: { id: userId },
            select: publicUserSelect,
        });

        emitToUser(friendId, "friend_request_received", {
            requestId: request.id,
            senderId: userId,
            senderName: sender?.displayName || sender?.username || "Người dùng",
            senderUsername: sender?.username || "",
            senderAvatarUrl: sender?.avatarUrl || null,
            createdAt: Number(request.createdAt),
        });

        return res.json({
            data: {
                id: request.id,
                senderId: request.senderId,
                receiverId: request.receiverId,
                status: request.status,
                createdAt: Number(request.createdAt),
            },
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Gửi yêu cầu kết bạn thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function acceptRequest(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { requestId } = req.body as { requestId: string };

        if (!requestId) {
            return res.status(400).json({ message: "Request ID là bắt buộc" });
        }

        const currentRequest = await prisma.friendRequest.findUnique({
            where: { id: requestId },
            select: { senderId: true, receiverId: true },
        });

        await acceptFriendRequest(requestId, userId);

        if (currentRequest) {
            const users = await getPublicUsers([currentRequest.senderId, currentRequest.receiverId]);
            const sender = users.get(currentRequest.senderId);
            const receiver = users.get(currentRequest.receiverId);

            emitToUser(currentRequest.senderId, "friend_request_resolved", { requestId, status: "accepted" });
            emitToUser(currentRequest.receiverId, "friend_request_resolved", { requestId, status: "accepted" });

            if (receiver) {
                emitToUser(currentRequest.senderId, "friendship_updated", {
                    status: "accepted",
                    friend: toFriendPayload(receiver),
                });
            }

            if (sender) {
                emitToUser(currentRequest.receiverId, "friendship_updated", {
                    status: "accepted",
                    friend: toFriendPayload(sender),
                });
            }
        }

        return res.json({
            data: { message: "Chấp nhận yêu cầu thành công" },
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Chấp nhận yêu cầu thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function rejectRequest(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { requestId } = req.body as { requestId: string };

        if (!requestId) {
            return res.status(400).json({ message: "Request ID là bắt buộc" });
        }

        const currentRequest = await prisma.friendRequest.findUnique({
            where: { id: requestId },
            select: { senderId: true, receiverId: true },
        });

        await rejectFriendRequest(requestId, userId);

        if (currentRequest) {
            emitToUser(currentRequest.senderId, "friend_request_resolved", { requestId, status: "rejected" });
            emitToUser(currentRequest.receiverId, "friend_request_resolved", { requestId, status: "rejected" });
        }

        return res.json({
            data: { message: "Từ chối yêu cầu thành công" },
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Từ chối yêu cầu thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function listPendingRequests(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const requests = await getPendingFriendRequests(userId);

        return res.json({
            data: requests,
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Lấy danh sách yêu cầu thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function searchFriendsHandler(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { keyword } = req.query as { keyword: string };

        if (!keyword || keyword.trim().length === 0) {
            return res.status(400).json({ message: "Keyword là bắt buộc" });
        }

        const results = await searchFriends(userId, keyword);

        return res.json({
            data: results,
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Tìm kiếm bạn bè thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}

export async function listFriends(req: IAuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const friends = await getFriendsList(userId);

        return res.json({
            data: friends,
        } as IApiResponse);
    } catch (error) {
        const errorMessage = (error as Error).message || "Lấy danh sách bạn bè thất bại";
        return res.status(400).json({ message: errorMessage });
    }
}
