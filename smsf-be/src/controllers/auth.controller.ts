import { Request, Response } from "express";
import { createHash } from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import config from "../config";
import {
    IJwtAuthPayload,
    ILoginPayload,
    ILogoutPayloadRequest,
    IRefreshTokenPayloadRequest,
    IUser,
} from "../interfaces/auth.interface";
import {
    blacklistToken,
    isRefreshTokenActive,
    revokeAllUserRefreshTokens,
    revokeRefreshToken,
    storeRefreshToken,
} from "../lib/auth-token-store";
import { esClient, withPrefix } from "../lib/es-client";

type IUserSource = {
    uId: string;
    username: string;
    password: string;
    role: IUser["role"];
};

const mapUserSource = (source: IUserSource): IUser => {
    return {
        id: String(source.uId),
        username: source.username,
        password: source.password,
        role: source.role,
    };
};

const searchUser = async (query: Record<string, unknown>): Promise<IUser | undefined> => {
    const indexes = [withPrefix("user"), withPrefix("user-*")];

    for (const indexName of indexes) {
        try {
            const response = await esClient.post(`/${indexName}/_search`, {
                size: 1,
                sort: [{ updatedAt: { order: "desc" } }],
                query,
            });

            const hit = response.data?.hits?.hits?.[0];
            if (hit?._source) {
                return mapUserSource(hit._source as IUserSource);
            }
        } catch (error) {
            const statusCode =
                (error as { response?: { status?: number } }).response?.status;
            if (statusCode === 404) {
                continue;
            }
            throw error;
        }
    }

    return undefined;
};

const findUserByCredentials = async (
    username: string,
    password: string,
): Promise<IUser | undefined> => {
    return searchUser({
        bool: {
            filter: [{ term: { username } }, { term: { password } }],
        },
    });
};

const hashPassword = (rawPassword: string): string => {
    return createHash("sha256").update(rawPassword).digest("hex");
};

const findUserById = async (userId: string): Promise<IUser | undefined> => {
    return searchUser({
        bool: {
            filter: [{ term: { uId: String(userId) } }],
        },
    });
};

/**
 * Generate JWT token for a user
 */
const generateAccessToken = (user: IUser): string => {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        tokenType: "access",
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as SignOptions["expiresIn"],
    });
};

const generateRefreshToken = (user: IUser): string => {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        tokenType: "refresh",
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"],
    });
};

/**
 * Login - validate credentials & return JWT
 */
const login = async (req: Request, res: Response): Promise<Response | void> => {
    try {
        const { username, password } = req.body as ILoginPayload;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required.",
            });
        }

        const hashedPassword = hashPassword(password);
        const user = await findUserByCredentials(username, hashedPassword);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password.",
            });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        storeRefreshToken(refreshToken, user.id);

        return res.json({
            success: true,
            message: "Login successful.",
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Login failed.",
        });
    }
};

const refreshToken = async (
    req: Request,
    res: Response,
): Promise<Response | void> => {
    try {
        const { refreshToken: rawRefreshToken } =
            req.body as IRefreshTokenPayloadRequest;

        if (!rawRefreshToken) {
            return res.status(400).json({
                success: false,
                message: "refreshToken is required.",
            });
        }

        const decoded = jwt.verify(
            rawRefreshToken,
            config.jwt.refreshSecret,
        ) as IJwtAuthPayload | string;

        if (typeof decoded === "string") {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token payload.",
            });
        }

        if (decoded.tokenType !== "refresh") {
            return res.status(401).json({
                success: false,
                message: "Invalid token type.",
            });
        }

        if (!isRefreshTokenActive(rawRefreshToken, decoded.id)) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is revoked or expired.",
            });
        }

        const user = await findUserById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User no longer exists.",
            });
        }

        revokeRefreshToken(rawRefreshToken);
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        storeRefreshToken(newRefreshToken, user.id);

        return res.json({
            success: true,
            message: "Token refreshed successfully.",
            data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired refresh token.",
        });
    }
};

const logout = (req: Request, res: Response): Response => {
    const accessToken = req.accessToken;
    const { refreshToken: rawRefreshToken } = req.body as ILogoutPayloadRequest;

    if (accessToken) {
        blacklistToken(accessToken);
    }

    if (rawRefreshToken) {
        revokeRefreshToken(rawRefreshToken);
        blacklistToken(rawRefreshToken);
    }

    if (req.user?.id) {
        revokeAllUserRefreshTokens(String(req.user.id));
    }

    return res.json({
        success: true,
        message: "Logout successful.",
    });
};

/**
 * Get current user profile (protected)
 */
const getProfile = (req: Request, res: Response): Response => {
    return res.json({
        success: true,
        data: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
        },
    });
};

export { login, getProfile };
export { refreshToken, logout };
