import { IWalletItem } from '@/types/calendar';

export interface IUserSession {
    id: string;
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
    updateTelegramChatId: (telegramChatId?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    refreshWallets: () => Promise<void>;
}

export interface ILoginResponse {
    success: boolean;
    message: string;
    data: {
        accessToken: string;
        refreshToken: string;
        user: IUserSession;
    };
}

export interface IProfileResponse {
    success: boolean;
    data: IUserSession;
}
