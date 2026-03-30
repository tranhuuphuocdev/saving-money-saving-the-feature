import axios, { AxiosError } from 'axios';
import { clearSession, setSession } from '@/lib/auth/storage';
import { ILoginResponse, IProfileResponse } from '@/types/auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = api
            .post('/auth/refresh')
            .then(() => true)
            .catch(() => {
                clearSession();
                return false;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & { _retry?: boolean };
        const requestPath = originalRequest?.url || '';
        const shouldSkipRefresh = ['/auth/login', '/auth/google', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
            requestPath.includes(path),
        );

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh) {
            originalRequest._retry = true;
            const refreshed = await refreshAccessToken();

            if (refreshed) {
                return api(originalRequest);
            }
        }

        return Promise.reject(error);
    },
);

export async function loginRequest(username: string, password: string): Promise<ILoginResponse['data']> {
    const response = await api.post<ILoginResponse>('/auth/login', {
        username,
        password,
    });
    const payload = response.data.data;
    setSession(payload.user);
    return payload;
}

export async function loginWithGoogleRequest(credential: string): Promise<ILoginResponse['data']> {
    const response = await api.post<ILoginResponse>('/auth/google', {
        credential,
    });
    const payload = response.data.data;
    setSession(payload.user);
    return payload;
}

export async function registerRequest(
    username: string,
    password: string,
    telegramChatId?: string,
): Promise<ILoginResponse['data']> {
    const response = await api.post<ILoginResponse>('/auth/register', {
        username,
        password,
        telegramChatId,
    });

    const payload = response.data.data;
    setSession(payload.user);
    return payload;
}

export async function getProfileRequest() {
    const response = await api.get<IProfileResponse>('/auth/profile');
    return response.data.data;
}

export async function updateTelegramChatIdRequest(telegramChatId?: string) {
    const response = await api.patch<IProfileResponse>('/auth/profile', {
        telegramChatId,
    });

    return response.data.data;
}

export async function updateProfileRequest(payload: { telegramChatId?: string; displayName?: string }) {
    const response = await api.patch<IProfileResponse>('/auth/profile', payload);
    return response.data.data;
}

export async function logoutRequest(): Promise<void> {
    try {
        await api.post('/auth/logout');
    } finally {
        clearSession();
    }
}

export { api, refreshAccessToken };
