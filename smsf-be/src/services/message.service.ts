import { prisma } from "../lib/prisma";
import { DirectMessage, FriendRequest } from "@prisma/client";

export async function sendDirectMessage(
    senderId: string,
    receiverId: string,
    content: string,
): Promise<DirectMessage> {
    if (!content.trim()) {
        throw new Error("Nội dung tin nhắn không được để trống");
    }

    // Check if users are friends
    const friendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userId: senderId, friendId: receiverId, status: "accepted" },
                { userId: receiverId, friendId: senderId, status: "accepted" },
            ],
        },
    });

    if (!friendship) {
        throw new Error("Bạn không phải bạn bè với người dùng này");
    }

    const message = await prisma.directMessage.create({
        data: {
            senderId,
            receiverId,
            content: content.trim(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    });

    return message;
}

export async function getDirectMessages(
    userId: string,
    friendId: string,
    limit: number = 50,
    offset: number = 0,
): Promise<DirectMessage[]> {
    const messages = await prisma.directMessage.findMany({
        where: {
            OR: [
                { senderId: userId, receiverId: friendId },
                { senderId: friendId, receiverId: userId },
            ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
    });

    return messages.reverse(); // Return in ascending order for display
}

export async function markMessagesAsRead(
    userId: string,
    friendId: string,
): Promise<number> {
    const result = await prisma.directMessage.updateMany({
        where: {
            receiverId: userId,
            senderId: friendId,
            isRead: false,
        },
        data: {
            isRead: true,
            updatedAt: Date.now(),
        },
    });

    return result.count;
}

export async function getConversationList(userId: string): Promise<Array<{
    friendId: string;
    friendName: string;
    friendUsername: string;
    friendAvatarUrl: string | null;
    lastMessage: string;
    lastMessageTime: number;
    unreadCount: number;
}>> {
    const conversations = await prisma.$queryRaw<Array<any>>`
        SELECT DISTINCT
            CASE
                WHEN dm.sender_u_id = ${userId} THEN dm.receiver_u_id
                ELSE dm.sender_u_id
            END as friend_id,
            MAX(dm.created_at) as last_message_time
        FROM direct_messages dm
        WHERE dm.sender_u_id = ${userId} OR dm.receiver_u_id = ${userId}
        GROUP BY friend_id
        ORDER BY last_message_time DESC
    `;

    const result = [];

    for (const conv of conversations) {
        const friendId = conv.friend_id;

        // Get friend info
        const friend = await prisma.user.findUnique({
            where: { id: friendId },
            select: {
                id: true,
                displayName: true,
                username: true,
                avatarUrl: true,
            },
        });

        if (!friend) continue;

        // Get last message
        const lastMsg = await prisma.directMessage.findFirst({
            where: {
                OR: [
                    { senderId: userId, receiverId: friendId },
                    { senderId: friendId, receiverId: userId },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 1,
        });

        // Count unread messages
        const unreadCount = await prisma.directMessage.count({
            where: {
                senderId: friendId,
                receiverId: userId,
                isRead: false,
            },
        });

        result.push({
            friendId,
            friendName: friend.displayName || friend.username,
            friendUsername: friend.username,
            friendAvatarUrl: friend.avatarUrl,
            lastMessage: lastMsg?.content || "",
            lastMessageTime: Number(lastMsg?.createdAt ?? conv.last_message_time ?? 0),
            unreadCount,
        });
    }

    return result;
}

export async function sendFriendRequest(
    senderId: string,
    receiverId: string,
): Promise<FriendRequest> {
    if (senderId === receiverId) {
        throw new Error("Không thể gửi yêu cầu kết bạn cho chính mình");
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userId: senderId, friendId: receiverId, status: "accepted" },
                { userId: receiverId, friendId: senderId, status: "accepted" },
            ],
        },
    });

    if (existingFriendship) {
        throw new Error("Bạn đã là bạn bè rồi");
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
        where: {
            OR: [
                { senderId, receiverId, status: "pending" },
                { senderId: receiverId, receiverId: senderId, status: "pending" },
            ],
        },
    });

    if (existingRequest) {
        throw new Error("Yêu cầu kết bạn đã được gửi");
    }

    const request = await prisma.friendRequest.create({
        data: {
            senderId,
            receiverId,
            status: "pending",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    });

    return request;
}

export async function acceptFriendRequest(
    requestId: string,
    userId: string,
): Promise<void> {
    const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
    });

    if (!request || request.receiverId !== userId) {
        throw new Error("Yêu cầu kết bạn không hợp lệ");
    }

    await prisma.$transaction(async (tx) => {
        await tx.friendRequest.update({
            where: { id: requestId },
            data: {
                status: "accepted",
                updatedAt: Date.now(),
            },
        });

        // Create friendship (both directions for easier querying)
        await tx.friendship.createMany({
            data: [
                {
                    userId: request.senderId,
                    friendId: request.receiverId,
                    status: "accepted",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
                {
                    userId: request.receiverId,
                    friendId: request.senderId,
                    status: "accepted",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                },
            ],
            skipDuplicates: true,
        });

        // Remove all pending requests between the two users to avoid stale UI state.
        await tx.friendRequest.deleteMany({
            where: {
                OR: [
                    { senderId: request.senderId, receiverId: request.receiverId, status: "pending" },
                    { senderId: request.receiverId, receiverId: request.senderId, status: "pending" },
                ],
            },
        });
    });
}

export async function rejectFriendRequest(
    requestId: string,
    userId: string,
): Promise<void> {
    const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
    });

    if (!request || request.receiverId !== userId) {
        throw new Error("Yêu cầu kết bạn không hợp lệ");
    }

    await prisma.friendRequest.delete({
        where: { id: requestId },
    });
}

export async function getPendingFriendRequests(userId: string): Promise<Array<{
    requestId: string;
    senderId: string;
    senderName: string;
    senderUsername: string;
    senderAvatarUrl: string | null;
    createdAt: number;
}>> {
    const requests = await prisma.friendRequest.findMany({
        where: { receiverId: userId, status: "pending" },
        include: {
            sender: {
                select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatarUrl: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return requests.map((req) => ({
        requestId: req.id,
        senderId: req.sender.id,
        senderName: req.sender.displayName || req.sender.username,
        senderUsername: req.sender.username,
        senderAvatarUrl: req.sender.avatarUrl,
        createdAt: Number(req.createdAt),
    }));
}

export async function searchFriends(
    userId: string,
    keyword: string,
    limit: number = 20,
): Promise<Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    isFriend: boolean;
    hasRequest: boolean;
    requestDirection: "incoming" | "outgoing" | null;
}>> {
    const users = await prisma.user.findMany({
        where: {
            AND: [
                { id: { not: userId } },
                { isDeleted: false },
                {
                    OR: [
                        { displayName: { contains: keyword.trim(), mode: "insensitive" } },
                        { username: { contains: keyword.trim(), mode: "insensitive" } },
                    ],
                },
            ],
        },
        select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
        },
        take: limit,
    });

    const result = [];

    for (const user of users) {
        // Check friendship
        const friendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId, friendId: user.id, status: "accepted" },
                    { userId: user.id, friendId: userId, status: "accepted" },
                ],
            },
        });

        // Check friend request
        const request = await prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderId: userId, receiverId: user.id, status: "pending" },
                    { senderId: user.id, receiverId: userId, status: "pending" },
                ],
            },
        });

        result.push({
            userId: user.id,
            displayName: user.displayName || user.username,
            username: user.username,
            avatarUrl: user.avatarUrl,
            isFriend: Boolean(friendship),
            hasRequest: Boolean(request),
            requestDirection: request
                ? request.senderId === userId
                    ? "outgoing"
                    : "incoming"
                : null,
        });
    }

    return result;
}

export async function getFriendsList(userId: string): Promise<Array<{
    friendId: string;
    friendName: string;
    friendUsername: string;
    friendAvatarUrl: string | null;
    createdAt: number;
}>> {
    const rows = await prisma.friendship.findMany({
        where: {
            status: "accepted",
            OR: [
                { userId },
                { friendId: userId },
            ],
        },
        include: {
            user: {
                select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatarUrl: true,
                    isDeleted: true,
                },
            },
            friend: {
                select: {
                    id: true,
                    displayName: true,
                    username: true,
                    avatarUrl: true,
                    isDeleted: true,
                },
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    const seenFriendIds = new Set<string>();
    const result = [];

    for (const row of rows) {
        const relatedFriend = row.userId === userId ? row.friend : row.user;

        if (!relatedFriend || relatedFriend.id === userId || relatedFriend.isDeleted) {
            continue;
        }

        if (seenFriendIds.has(relatedFriend.id)) {
            continue;
        }

        seenFriendIds.add(relatedFriend.id);
        result.push({
            friendId: relatedFriend.id,
            friendName: relatedFriend.displayName || relatedFriend.username,
            friendUsername: relatedFriend.username,
            friendAvatarUrl: relatedFriend.avatarUrl,
            createdAt: Number(row.createdAt),
        });
    }

    return result;
}
