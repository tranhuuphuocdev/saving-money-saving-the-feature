'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import {
    initializeSocket,
    getSocket,
    disconnectSocket,
    onMessageReceived,
    onMessageSent,
} from '@/lib/socket-io';
import { IDirectMessage } from '@/types/messages';

interface ISocketContextValue {
    isConnected: boolean;
    isInitialized: boolean;
    sendMessage: (receiverId: string, content: string) => void;
    onMessage: (callback: (message: IDirectMessage) => void) => void;
    onMessageSent: (callback: (message: IDirectMessage) => void) => void;
    markTyping: (friendId: string, isTyping: boolean) => void;
}

const SocketContext = createContext<ISocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        // Initialize Socket.io
        const socket = initializeSocket(user.id);

        socket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socket.on('authenticated', () => {
            console.log('Socket authenticated');
            setIsInitialized(true);
        });

        return () => {
            disconnectSocket();
        };
    }, [user?.id]);

    const sendMessage = useCallback((receiverId: string, content: string) => {
        const socket = getSocket();
        if (socket && isConnected) {
            socket.emit('send_message', { receiverId, content });
        }
    }, [isConnected]);

    const onMessageCallback = useCallback((callback: (message: IDirectMessage) => void) => {
        onMessageReceived(callback);
    }, []);

    const onMessageSentCallback = useCallback((callback: (message: IDirectMessage) => void) => {
        onMessageSent(callback);
    }, []);

    const markTyping = useCallback((friendId: string, isTyping: boolean) => {
        const socket = getSocket();
        if (socket && isConnected) {
            socket.emit('typing', { friendId, isTyping });
        }
    }, [isConnected]);

    const value: ISocketContextValue = {
        isConnected,
        isInitialized,
        sendMessage,
        onMessage: onMessageCallback,
        onMessageSent: onMessageSentCallback,
        markTyping,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
}
