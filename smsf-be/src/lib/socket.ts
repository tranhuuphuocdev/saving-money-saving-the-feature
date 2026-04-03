import { Server, Socket } from "socket.io";
import { sendDirectMessage, markMessagesAsRead, getConversationList } from "../services/message.service";
import { prisma } from "./prisma";

// Store user socket mappings
const userSocketMap = new Map<string, string>();
let socketServer: Server | null = null;

const toSocketMessagePayload = (message: {
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

export function initializeSocket(io: Server) {
    socketServer = io;

    io.on("connection", (socket: Socket) => {
        console.log(`New client connected: ${socket.id}`);

        // User authentication
        socket.on("authenticate", async (data: { userId: string }) => {
            try {
                const { userId } = data;

                // Verify user exists
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                });

                if (!user) {
                    socket.emit("error", { message: "Người dùng không tồn tại" });
                    return;
                }

                // Store user-socket mapping
                userSocketMap.set(userId, socket.id);
                socket.data.userId = userId;
                socket.join(`user:${userId}`);

                socket.emit("authenticated", { message: "Xác thực thành công" });
                console.log(`User ${userId} authenticated with socket ${socket.id}`);
            } catch (error) {
                console.error("Authentication error:", error);
                socket.emit("error", { message: "Xác thực thất bại" });
            }
        });

        // Send message
        socket.on("send_message", async (data: { receiverId: string; content: string }) => {
            try {
                const userId = socket.data.userId;

                if (!userId) {
                    socket.emit("error", { message: "Chưa xác thực" });
                    return;
                }

                const { receiverId, content } = data;

                const message = await sendDirectMessage(userId, receiverId, content);
                const payload = toSocketMessagePayload(message);

                // Broadcast to both sender and receiver
                io.to(`user:${userId}`).emit("message_sent", payload);

                io.to(`user:${receiverId}`).emit("message_received", payload);

                console.log(`Message sent from ${userId} to ${receiverId}`);
            } catch (error) {
                const errorMessage = (error as Error).message || "Gửi tin nhắn thất bại";
                socket.emit("error", { message: errorMessage });
                console.error("Send message error:", error);
            }
        });

        // Mark messages as read
        socket.on("mark_read", async (data: { friendId: string }) => {
            try {
                const userId = socket.data.userId;

                if (!userId) {
                    socket.emit("error", { message: "Chưa xác thực" });
                    return;
                }

                const { friendId } = data;

                await markMessagesAsRead(userId, friendId);

                // Notify the other user
                io.to(`user:${friendId}`).emit("messages_read", {
                    readBy: userId,
                    reader: userId,
                });

                console.log(`Messages marked as read by ${userId}`);
            } catch (error) {
                console.error("Mark as read error:", error);
            }
        });

        // Get conversation list
        socket.on("get_conversations", async () => {
            try {
                const userId = socket.data.userId;

                if (!userId) {
                    socket.emit("error", { message: "Chưa xác thực" });
                    return;
                }

                const conversations = await getConversationList(userId);
                socket.emit("conversations_list", conversations);
            } catch (error) {
                console.error("Get conversations error:", error);
                socket.emit("error", { message: "Lấy danh sách cuộc trò chuyện thất bại" });
            }
        });

        // User is typing
        socket.on("typing", (data: { friendId: string; isTyping: boolean }) => {
            try {
                const userId = socket.data.userId;
                const { friendId, isTyping } = data;

                if (!userId) {
                    socket.emit("error", { message: "Chưa xác thực" });
                    return;
                }

                io.to(`user:${friendId}`).emit("user_typing", {
                    userId,
                    isTyping,
                });
            } catch (error) {
                console.error("Typing event error:", error);
            }
        });

        // Handle disconnection
        socket.on("disconnect", () => {
            const userId = socket.data.userId;

            if (userId) {
                userSocketMap.delete(userId);
                console.log(`User ${userId} disconnected`);
            } else {
                console.log(`Client ${socket.id} disconnected`);
            }
        });

        // Error handling
        socket.on("error", (error) => {
            console.error(`Socket error: ${error}`);
        });
    });

    console.log("Socket.io initialized");
}

export function getUserSocket(userId: string): string | undefined {
    return userSocketMap.get(userId);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
    if (!socketServer) {
        return;
    }

    socketServer.to(`user:${userId}`).emit(event, payload);
}
