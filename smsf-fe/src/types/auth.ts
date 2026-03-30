import { IWalletItem } from '@/types/calendar';

export interface IUserSession {
    id: string;
    displayName?: string;
    username: string;
    role: string;
    telegramChatId?: string;
}

export interface IAuthContextValue {
    user: IUserSession | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    totalWalletBalance: number;
    wallets: IWalletItem[];
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string, telegramChatId?: string) => Promise<void>;
    createWallet: (payload: { name: string; type?: string; balance?: number }) => Promise<void>;
    updateTelegramChatId: (telegramChatId?: string, displayName?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    refreshWallets: () => Promise<void>;
    updateWalletActive: (walletId: string, isActive: boolean) => Promise<void>;
}

export interface ILoginResponse {
    success: boolean;
    message: string;
    data: {
        user: IUserSession;
    };
}

export interface IProfileResponse {
    success: boolean;
    data: IUserSession;
}
