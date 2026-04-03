import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;
const socketListeners = new Map<string, Set<(data: any) => void>>();

function attachStoredListeners(socket: Socket) {
    for (const [event, listeners] of socketListeners.entries()) {
        for (const listener of listeners) {
            socket.on(event, listener);
        }
    }
}

function addSocketListener(event: string, callback: (data: any) => void) {
    const listeners = socketListeners.get(event) || new Set<(data: any) => void>();

    if (!listeners.has(callback)) {
        listeners.add(callback);
        socketListeners.set(event, listeners);
        socketInstance?.on(event, callback);
    }
}

function removeSocketListener(event: string, callback: (data: any) => void) {
    const listeners = socketListeners.get(event);
    if (!listeners) return;

    listeners.delete(callback);
    socketInstance?.off(event, callback);

    if (listeners.size === 0) {
        socketListeners.delete(event);
    }
}

export function initializeSocket(userId: string): Socket {
    if (socketInstance) {
        return socketInstance;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || 3000}`;

    socketInstance = io(apiUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ["websocket", "polling"],
    });

    attachStoredListeners(socketInstance);

    socketInstance.on("connect", () => {
        console.log("Socket connected");
        socketInstance?.emit("authenticate", { userId });
    });

    socketInstance.on("authenticated", (data) => {
        console.log("Socket authenticated:", data.message);
    });

    socketInstance.on("error", (error) => {
        console.error("Socket error:", error);
    });

    socketInstance.on("reconnect", () => {
        console.log("Socket reconnected");
        socketInstance?.emit("authenticate", { userId });
    });

    socketInstance.on("disconnect", () => {
        console.log("Socket disconnected");
    });

    return socketInstance;
}

export function getSocket(): Socket | null {
    return socketInstance;
}

export function disconnectSocket() {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
}

export function sendMessage(receiverId: string, content: string) {
    if (!socketInstance) {
        return false;
    }

    socketInstance.emit("send_message", { receiverId, content });
    return true;
}

export function markMessagesAsRead(friendId: string) {
    if (!socketInstance) {
        return false;
    }

    socketInstance.emit("mark_read", { friendId });
    return true;
}

export function getConversationList() {
    if (!socketInstance) {
        return false;
    }

    socketInstance.emit("get_conversations");
    return true;
}

export function setTyping(friendId: string, isTyping: boolean) {
    if (!socketInstance) {
        return false;
    }

    socketInstance.emit("typing", { friendId, isTyping });
    return true;
}

export function onMessageReceived(callback: (data: any) => void) {
    addSocketListener("message_received", callback);
}

export function onMessageSent(callback: (data: any) => void) {
    addSocketListener("message_sent", callback);
}

export function onMessagesRead(callback: (data: any) => void) {
    addSocketListener("messages_read", callback);
}

export function onConversationsList(callback: (data: any) => void) {
    addSocketListener("conversations_list", callback);
}

export function onUserTyping(callback: (data: any) => void) {
    addSocketListener("user_typing", callback);
}

export function onFriendRequestReceived(callback: (data: any) => void) {
    addSocketListener("friend_request_received", callback);
}

export function onFriendRequestResolved(callback: (data: any) => void) {
    addSocketListener("friend_request_resolved", callback);
}

export function onFriendshipUpdated(callback: (data: any) => void) {
    addSocketListener("friendship_updated", callback);
}

export function onSharedFundInviteReceived(callback: (data: any) => void) {
    addSocketListener("shared_fund_invite_received", callback);
}

export function onSharedFundInviteResolved(callback: (data: any) => void) {
    addSocketListener("shared_fund_invite_resolved", callback);
}

export function onSharedFundMembershipUpdated(callback: (data: any) => void) {
    addSocketListener("shared_fund_membership_updated", callback);
}

export function onSharedFundActivity(callback: (data: any) => void) {
    addSocketListener("shared_fund_activity", callback);
}

export function offMessageReceived(callback: (data: any) => void) {
    removeSocketListener("message_received", callback);
}

export function offMessageSent(callback: (data: any) => void) {
    removeSocketListener("message_sent", callback);
}

export function offMessagesRead(callback: (data: any) => void) {
    removeSocketListener("messages_read", callback);
}

export function offConversationsList(callback: (data: any) => void) {
    removeSocketListener("conversations_list", callback);
}

export function offUserTyping(callback: (data: any) => void) {
    removeSocketListener("user_typing", callback);
}

export function offFriendRequestReceived(callback: (data: any) => void) {
    removeSocketListener("friend_request_received", callback);
}

export function offFriendRequestResolved(callback: (data: any) => void) {
    removeSocketListener("friend_request_resolved", callback);
}

export function offFriendshipUpdated(callback: (data: any) => void) {
    removeSocketListener("friendship_updated", callback);
}

export function offSharedFundInviteReceived(callback: (data: any) => void) {
    removeSocketListener("shared_fund_invite_received", callback);
}

export function offSharedFundInviteResolved(callback: (data: any) => void) {
    removeSocketListener("shared_fund_invite_resolved", callback);
}

export function offSharedFundMembershipUpdated(callback: (data: any) => void) {
    removeSocketListener("shared_fund_membership_updated", callback);
}

export function offSharedFundActivity(callback: (data: any) => void) {
    removeSocketListener("shared_fund_activity", callback);
}
