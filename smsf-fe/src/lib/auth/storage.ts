const ACCESS_TOKEN_KEY = 'smsf.accessToken';
const REFRESH_TOKEN_KEY = 'smsf.refreshToken';
const USER_KEY = 'smsf.user';

import { IUserSession } from '@/types/auth';

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): IUserSession | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as IUserSession) : null;
}

export function setSession(accessToken: string, refreshToken: string, user: IUserSession): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateTokens(accessToken: string, refreshToken: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
}
