import { IWalletItem } from '@/types/calendar';

export interface IUserSession {
    id: number;
    username: string;
    role: string;
}

export interface IAuthContextValue {
    user: IUserSession | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    totalWalletBalance: number;
    wallets: IWalletItem[];
    login: (username: string, password: string) => Promise<void>;
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
