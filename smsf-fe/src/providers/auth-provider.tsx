'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfileRequest, loginRequest, loginWithGoogleRequest, logoutRequest, refreshAccessToken, registerRequest, updateProfileRequest, uploadProfileAvatarRequest } from '@/lib/auth/api';
import { createWalletRequest, getWalletsRequest, initializeWalletSetupRequest, reorderWalletRequest, updateWalletActiveRequest } from '@/lib/calendar/api';
import { clearSession, getStoredUser, setSession } from '@/lib/auth/storage';
import { IAuthContextValue, IUserSession } from '@/types/auth';
import { IWalletItem } from '@/types/calendar';

const AuthContext = createContext<IAuthContextValue | null>(null);

function getPersonalWalletTotal(wallets: IWalletItem[]): number {
    return wallets
        .filter((wallet) => wallet.type !== 'shared-fund')
        .reduce((sum, wallet) => sum + wallet.balance, 0);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<IUserSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [wallets, setWallets] = useState<IWalletItem[]>([]);
    const [totalWalletBalance, setTotalWalletBalance] = useState(0);
    const [requiresInitialWalletSetup, setRequiresInitialWalletSetup] = useState(false);

    const refreshWallets = useCallback(async () => {
        const summary = await getWalletsRequest();
        setWallets(summary.wallets);
        setTotalWalletBalance(getPersonalWalletTotal(summary.wallets));
        setRequiresInitialWalletSetup(summary.requiresInitialSetup);
    }, [user?.id]);

    const refreshWalletsSafely = useCallback(async () => {
        try {
            await refreshWallets();
        } catch {
            setWallets([]);
            setTotalWalletBalance(0);
            setRequiresInitialWalletSetup(false);
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

    useEffect(() => {
        if (!user) {
            return;
        }

        const handleTransactionChanged = () => {
            void refreshWalletsSafely();
        };

        window.addEventListener('transaction:changed', handleTransactionChanged);

        return () => {
            window.removeEventListener('transaction:changed', handleTransactionChanged);
        };
    }, [refreshWalletsSafely, user]);

    const login = useCallback(async (username: string, password: string) => {
        const data = await loginRequest(username, password);
        setSession(data.user);
        setUser(data.user);
        void refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const loginWithGoogle = useCallback(async (credential: string) => {
        const data = await loginWithGoogleRequest(credential);
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

    const uploadAvatar = useCallback(async (file: File) => {
        const profile = await uploadProfileAvatarRequest(file);
        setSession(profile);
        setUser(profile);
    }, []);

    const createWallet = useCallback(async (payload: { name: string; type?: string; balance?: number }) => {
        await createWalletRequest(payload);
        await refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const initializeWalletSetup = useCallback(async (payload: { wallets: Array<{ walletId: string; balance: number }> }) => {
        const summary = await initializeWalletSetupRequest(payload);
        setWallets(summary.wallets);
        setTotalWalletBalance(getPersonalWalletTotal(summary.wallets));
        setRequiresInitialWalletSetup(summary.requiresInitialSetup);
    }, []);

    const updateWalletActive = useCallback(async (walletId: string, isActive: boolean) => {
        await updateWalletActiveRequest(walletId, isActive);
        await refreshWalletsSafely();
    }, [refreshWalletsSafely]);

    const reorderWallets = useCallback(async (walletId: string) => {
        const index = wallets.findIndex((w) => w.id === walletId);
        if (index <= 0) {
            return;
        }

        const next = [...wallets];
        const [wallet] = next.splice(index, 1);
        next.unshift(wallet);
        setWallets(next);
        await reorderWalletRequest(walletId, 0);
    }, [wallets]);

    const dragReorderWallets = useCallback(async (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) {
            return;
        }

        const next = [...wallets];
        const [wallet] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, wallet);
        setWallets(next);
        await reorderWalletRequest(wallet.id, toIndex);
    }, [wallets]);

    const logout = useCallback(async () => {
        await logoutRequest();
        setUser(null);
        setWallets([]);
        setTotalWalletBalance(0);
        setRequiresInitialWalletSetup(false);
    }, []);

    const value = useMemo<IAuthContextValue>(
        () => ({
            user,
            isLoading,
            isAuthenticated: Boolean(user),
            totalWalletBalance,
            wallets,
            requiresInitialWalletSetup,
            login,
            loginWithGoogle,
            register,
            createWallet,
            initializeWalletSetup,
            updateTelegramChatId,
            uploadAvatar,
            logout,
            refreshProfile,
            refreshWallets,
            updateWalletActive,
            reorderWallets,
            dragReorderWallets,
        }),
        [
            isLoading,
            login,
            loginWithGoogle,
            register,
            createWallet,
            initializeWalletSetup,
            updateTelegramChatId,
            uploadAvatar,
            logout,
            refreshProfile,
            refreshWallets,
            requiresInitialWalletSetup,
            totalWalletBalance,
            user,
            wallets,
            requiresInitialWalletSetup,
            updateWalletActive,
            reorderWallets,
            dragReorderWallets,
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
