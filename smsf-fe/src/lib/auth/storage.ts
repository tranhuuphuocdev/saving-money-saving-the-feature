const USER_KEY = 'smsf.user';

import { IUserSession } from '@/types/auth';

export function getStoredUser(): IUserSession | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as IUserSession) : null;
}

export function setSession(user: IUserSession): void {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
    window.localStorage.removeItem(USER_KEY);
}
