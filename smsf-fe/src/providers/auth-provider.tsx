'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfileRequest, loginRequest, loginWithGoogleRequest, logoutRequest, refreshAccessToken, registerRequest, updateProfileRequest, uploadProfileAvatarRequest } from '@/lib/auth/api';
import { createWalletRequest, getWalletsRequest, initializeWalletSetupRequest, reorderWalletRequest, updateWalletActiveRequest, updateWalletNameRequest } from '@/lib/calendar/api';
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

    const updateWalletName = useCallback(async (walletId: string, name: string) => {
        await updateWalletNameRequest(walletId, name);
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

    const dragReorderWallets = useCallback(async (fromIndex: number, toIndex: number, orderedWalletIds?: string[]) => {
        if (fromIndex === toIndex) {
            return;
        }

        const orderedIds = orderedWalletIds && orderedWalletIds.length > 0
            ? orderedWalletIds
            : wallets.map((wallet) => wallet.id);
        const movingWalletId = orderedIds[fromIndex];

        if (!movingWalletId) {
            return;
        }

        const reorderedSubsetIds = [...orderedIds];
        const [movedSubsetId] = reorderedSubsetIds.splice(fromIndex, 1);
        reorderedSubsetIds.splice(toIndex, 0, movedSubsetId);

        const subsetIdSet = new Set(orderedIds);
        const desiredWallets: IWalletItem[] = [];
        let subsetCursor = 0;

        for (const wallet of wallets) {
            if (!subsetIdSet.has(wallet.id)) {
                desiredWallets.push(wallet);
                continue;
            }

            const nextSubsetWalletId = reorderedSubsetIds[subsetCursor];
            const nextSubsetWallet = wallets.find((candidate) => candidate.id === nextSubsetWalletId);
            if (nextSubsetWallet) {
                desiredWallets.push(nextSubsetWallet);
            }
            subsetCursor += 1;
        }

        setWallets(desiredWallets);

        const persistedOrder = [...wallets];
        for (let index = 0; index < desiredWallets.length; index += 1) {
            const desiredWalletId = desiredWallets[index]?.id;
            const currentIndex = persistedOrder.findIndex((wallet) => wallet.id === desiredWalletId);

            if (!desiredWalletId || currentIndex < 0 || currentIndex === index) {
                continue;
            }

            const [wallet] = persistedOrder.splice(currentIndex, 1);
            persistedOrder.splice(index, 0, wallet);
            await reorderWalletRequest(wallet.id, index);
        }
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
            updateWalletName,
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
            updateWalletName,
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
