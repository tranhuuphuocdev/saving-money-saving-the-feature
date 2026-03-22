import jwt, { JwtPayload } from "jsonwebtoken";

interface IRefreshTokenMetadata {
    userId: string;
    expiresAt: number;
}

const blacklistedTokens = new Map<string, number>();
const refreshTokens = new Map<string, IRefreshTokenMetadata>();

function getTokenExpiryMs(token: string): number {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded?.exp) {
        return Date.now() + 24 * 60 * 60 * 1000;
    }

    return decoded.exp * 1000;
}

export function blacklistToken(token: string): void {
    const expiresAt = getTokenExpiryMs(token);
    if (expiresAt > Date.now()) {
        blacklistedTokens.set(token, expiresAt);
    }
}

export function isTokenBlacklisted(token: string): boolean {
    const expiresAt = blacklistedTokens.get(token);

    if (!expiresAt) {
        return false;
    }

    if (expiresAt <= Date.now()) {
        blacklistedTokens.delete(token);
        return false;
    }

    return true;
}

export function storeRefreshToken(token: string, userId: string): void {
    refreshTokens.set(token, {
        userId,
        expiresAt: getTokenExpiryMs(token),
    });
}

export function isRefreshTokenActive(token: string, userId?: string): boolean {
    const tokenData = refreshTokens.get(token);
    if (!tokenData) {
        return false;
    }

    if (tokenData.expiresAt <= Date.now()) {
        refreshTokens.delete(token);
        return false;
    }

    if (typeof userId === "string" && tokenData.userId !== userId) {
        return false;
    }

    return true;
}

export function revokeRefreshToken(token: string): void {
    refreshTokens.delete(token);
}

export function revokeAllUserRefreshTokens(userId: string): void {
    refreshTokens.forEach((data, token) => {
        if (data.userId === userId) {
            refreshTokens.delete(token);
        }
    });
}
