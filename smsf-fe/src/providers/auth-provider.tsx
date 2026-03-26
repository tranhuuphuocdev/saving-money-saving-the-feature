'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfileRequest, loginRequest, logoutRequest, refreshAccessToken, registerRequest, updateProfileRequest } from '@/lib/auth/api';
import { createWalletRequest, getWalletsRequest } from '@/lib/calendar/api';
import { clearSession, getStoredUser, setSession } from '@/lib/auth/storage';
import { IAuthContextValue, IUserSession } from '@/types/auth';
import { IWalletItem } from '@/types/calendar';

const AuthContext = createContext<IAuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<IUserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [wallets, setWallets] = useState<IWalletItem[]>([]);
    const [totalWalletBalance, setTotalWalletBalance] = useState(0);

    const refreshWallets = useCallback(async () => {
        const summary = await getWalletsRequest();
        setWallets(summary.wallets);
        setTotalWalletBalance(summary.totalAmount);
    }, []);

    const refreshWalletsSafely = useCallback(async () => {
        try {
            await refreshWallets();
        } catch {
            setWallets([]);
            setTotalWalletBalance(0);
        }
    }, [refreshWallets]);

    const refreshProfile = useCallback(async () => {
        const profile = await getProfileRequest();
        setSession(profile);
        setUser(profile);
    }, []);

    const bootstrap = useCallback(async () => {
        try {
            const storedUser = getStoredUser();

            if (storedUser) {
                setUser(storedUser);
            }

            try {
                await refreshProfile();
            } catch {
                const refreshed = await refreshAccessToken();

                if (!refreshed) {
                    clearSession();
                    setUser(null);
                    setWallets([]);
                    setTotalWalletBalance(0);
                    return;
                }

                await refreshProfile();
            }

            await refreshWalletsSafely();
        } finally {
            setIsLoading(false);
        }
    }, [refreshProfile, refreshWalletsSafely]);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    const login = useCallback(async (username: string, password: string) => {
        const data = await loginRequest(username, password);
        setSession(data.user);
        setUser(data.user);
        void refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const register = useCallback(async (username: string, password: string, telegramChatId?: string) => {
        const data = await registerRequest(username, password, telegramChatId);
        setSession(data.user);
        setUser(data.user);
        void refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const updateTelegramChatId = useCallback(async (telegramChatId?: string, displayName?: string) => {
        const profile = await updateProfileRequest({ telegramChatId, displayName });
        setSession(profile);
        setUser(profile);
    }, []);

    const createWallet = useCallback(async (payload: { name: string; type?: string; balance?: number }) => {
        await createWalletRequest(payload);
        await refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const logout = useCallback(async () => {
        await logoutRequest();
        setUser(null);
        setWallets([]);
        setTotalWalletBalance(0);
    }, []);

    const value = useMemo<IAuthContextValue>(
        () => ({
            user,
            isLoading,
            isAuthenticated: Boolean(user),
            totalWalletBalance,
            wallets,
            login,
            register,
            createWallet,
            updateTelegramChatId,
            logout,
            refreshProfile,
            refreshWallets,
        }),
        [
            isLoading,
            login,
            register,
            createWallet,
            updateTelegramChatId,
            logout,
            refreshProfile,
            refreshWallets,
            totalWalletBalance,
            user,
            wallets,
        ],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): IAuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
}
