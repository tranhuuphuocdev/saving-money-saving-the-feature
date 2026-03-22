import axios, { AxiosError } from 'axios';
import { clearSession, getAccessToken, getRefreshToken, setSession, updateTokens } from '@/lib/auth/storage';
import { ILoginResponse, IProfileResponse } from '@/types/auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://160.250.181.32:3000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
        clearSession();
        return null;
    }

    if (!refreshPromise) {
        refreshPromise = api
            .post('/auth/refresh', { refreshToken })
            .then((response) => {
                const { accessToken, refreshToken: nextRefreshToken } = response.data.data;
                updateTokens(accessToken, nextRefreshToken);
                return accessToken as string;
            })
            .catch(() => {
                clearSession();
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

api.interceptors.request.use((config) => {
    const token = getAccessToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & { _retry?: boolean };

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            const nextToken = await refreshAccessToken();

            if (nextToken && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${nextToken}`;
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
    setSession(payload.accessToken, payload.refreshToken, payload.user);
    return payload;
}

export async function getProfileRequest() {
    const response = await api.get<IProfileResponse>('/auth/profile');
    return response.data.data;
}

export async function logoutRequest(): Promise<void> {
    const refreshToken = getRefreshToken();

    try {
        await api.post('/auth/logout', { refreshToken });
    } finally {
        clearSession();
    }
}

export { api, refreshAccessToken };
