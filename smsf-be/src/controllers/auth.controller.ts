import { CookieOptions, Request, Response } from "express";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import config from "../config";
import {
    IJwtAuthPayload,
    ILoginPayload,
    IRegisterPayload,
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
import { listWalletsByUserId } from "../services/wallet.service";

type IUserSource = {
    uId: string;
    dn?: string;
    username: string;
    password: string;
    role: IUser["role"];
    teleChatId?: string;
    createdAt?: number;
    updatedAt?: number;
    isDeleted?: boolean;
};

type IUserHit = {
    _id: string;
    _index: string;
    _source: IUserSource;
};

const mapUserSource = (source: IUserSource): IUser => {
    return {
        id: String(source.uId),
        displayName: String(source.dn || source.username || source.uId),
        username: source.username,
        password: source.password,
        role: source.role,
        telegramChatId: source.teleChatId ? String(source.teleChatId) : undefined,
    };
};

const searchUserDocument = async (query: Record<string, unknown>): Promise<IUserHit | undefined> => {
    const indexes = [withPrefix("user")];

    for (const indexName of indexes) {
        try {
            const response = await esClient.post(`/${indexName}/_search`, {
                size: 1,
                sort: [{ updatedAt: { order: "desc" } }],
                query,
            });

            const hit = response.data?.hits?.hits?.[0] as IUserHit | undefined;
            if (hit?._source) {
                return hit;
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

const searchUser = async (query: Record<string, unknown>): Promise<IUser | undefined> => {
    const hit = await searchUserDocument(query);
    return hit?._source ? mapUserSource(hit._source) : undefined;
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

const findUserByUsername = async (username: string): Promise<IUser | undefined> => {
    return searchUser({
        bool: {
            filter: [{ term: { username } }],
            must_not: [{ term: { isDeleted: true } }],
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
            must_not: [{ term: { isDeleted: true } }],
        },
    });
};

const createUserDocument = async (payload: IUserSource): Promise<void> => {
    const indexName = withPrefix("user");

    await esClient.put(`/${indexName}/_doc/${payload.uId}?refresh=true`, payload);
};

const updateUserTelegramChatId = async (
    userId: string,
    payload: {
        telegramChatId?: string;
        displayName?: string;
    },
): Promise<IUser | undefined> => {
    const hit = await searchUserDocument({
        bool: {
            filter: [{ term: { uId: String(userId) } }],
            must_not: [{ term: { isDeleted: true } }],
        },
    });

    if (!hit?._source) {
        return undefined;
    }

    const updatedSource: IUserSource = {
        ...hit._source,
        teleChatId: payload.telegramChatId || "",
        dn: payload.displayName || hit._source.dn || hit._source.username,
        updatedAt: Date.now(),
    };

    await esClient.put(`/${hit._index}/_doc/${hit._id}?refresh=true`, updatedSource);

    return mapUserSource(updatedSource);
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

const parseDurationToMs = (duration: string | number): number => {
    if (typeof duration === "number") {
        return duration * 1000;
    }

    const normalized = String(duration || "").trim();
    if (!normalized) {
        return 0;
    }

    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) {
        return asNumber * 1000;
    }

    const matched = normalized.match(/^(\d+)\s*(ms|s|m|h|d|w)$/i);
    if (!matched) {
        return 0;
    }

    const value = Number(matched[1]);
    const unit = matched[2].toLowerCase();

    const unitMap: Record<string, number> = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
    };

    return value * (unitMap[unit] || 0);
};

const buildCookieOptions = (maxAge: number, path = "/"): CookieOptions => {
    const options: CookieOptions = {
        httpOnly: true,
        secure: config.authCookies.secure,
        sameSite: config.authCookies.sameSite,
        maxAge,
        path,
    };

    if (config.authCookies.domain) {
        options.domain = config.authCookies.domain;
    }

    return options;
};

const setAuthCookies = (
    res: Response,
    payload: { accessToken: string; refreshToken: string },
): void => {
    const accessTokenMaxAge = parseDurationToMs(config.jwt.expiresIn);
    const refreshTokenMaxAge = parseDurationToMs(config.jwt.refreshExpiresIn);
    const refreshPath = `/api/${config.api.defaultVersion}/auth`;

    res.cookie(
        config.authCookies.accessTokenName,
        payload.accessToken,
        buildCookieOptions(accessTokenMaxAge, "/"),
    );
    res.cookie(
        config.authCookies.refreshTokenName,
        payload.refreshToken,
        buildCookieOptions(refreshTokenMaxAge, refreshPath),
    );
};

const clearAuthCookies = (res: Response): void => {
    const refreshPath = `/api/${config.api.defaultVersion}/auth`;

    res.clearCookie(
        config.authCookies.accessTokenName,
        buildCookieOptions(0, "/"),
    );
    res.clearCookie(
        config.authCookies.refreshTokenName,
        buildCookieOptions(0, refreshPath),
    );
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
        setAuthCookies(res, { accessToken, refreshToken });

        return res.json({
            success: true,
            message: "Login successful.",
            data: {
                user: {
                    id: user.id,
                    displayName: user.displayName,
                    username: user.username,
                    role: user.role,
                    telegramChatId: user.telegramChatId,
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

const register = async (req: Request, res: Response): Promise<Response | void> => {
    try {
        const { username, password, telegramChatId } = req.body as IRegisterPayload;

        const safeUsername = String(username || "").trim();
        const safePassword = String(password || "").trim();
        const safeTelegramChatId = String(telegramChatId || "").trim();

        if (!safeUsername || !safePassword) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required.",
            });
        }

        if (safeUsername.length < 3 || safeUsername.length > 40) {
            return res.status(400).json({
                success: false,
                message: "Username must be between 3 and 40 characters.",
            });
        }

        if (safePassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters.",
            });
        }

        const existingUser = await findUserByUsername(safeUsername);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username already exists.",
            });
        }

        const now = Date.now();
        const newUser: IUserSource = {
            uId: randomUUID(),
            dn: safeUsername,
            username: safeUsername,
            password: hashPassword(safePassword),
            role: "user",
            teleChatId: safeTelegramChatId || undefined,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
        };

        await createUserDocument(newUser);
        await listWalletsByUserId(newUser.uId);

        const user: IUser = mapUserSource(newUser);
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        storeRefreshToken(refreshToken, user.id);
        setAuthCookies(res, { accessToken, refreshToken });

        return res.status(201).json({
            success: true,
            message: "Register successful.",
            data: {
                user: {
                    id: user.id,
                    displayName: user.displayName,
                    username: user.username,
                    role: user.role,
                    telegramChatId: user.telegramChatId,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Register failed.",
        });
    }
};

const refreshToken = async (
    req: Request,
    res: Response,
): Promise<Response | void> => {
    try {
        const rawRefreshToken = req.cookies?.[
            config.authCookies.refreshTokenName
        ] as string | undefined;

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
        setAuthCookies(res, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });

        return res.json({
            success: true,
            message: "Token refreshed successfully.",
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
    const rawRefreshToken = req.cookies?.[
        config.authCookies.refreshTokenName
    ] as string | undefined;

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

    clearAuthCookies(res);

    return res.json({
        success: true,
        message: "Logout successful.",
    });
};

/**
 * Get current user profile (protected)
 */
const getProfile = async (req: Request, res: Response): Promise<Response> => {
    const user = await findUserById(String(req.user.id));

    return res.json({
        success: true,
        data: {
            id: req.user.id,
            displayName: user?.displayName,
            username: req.user.username,
            role: req.user.role,
            telegramChatId: user?.telegramChatId,
        },
    });
};

const updateProfile = async (req: Request, res: Response): Promise<Response> => {
    const userId = String(req.user?.id || "").trim();

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const telegramChatId =
        req.body?.telegramChatId === undefined || req.body?.telegramChatId === null
            ? undefined
            : String(req.body.telegramChatId).trim();

    const displayName =
        req.body?.displayName === undefined || req.body?.displayName === null
            ? undefined
            : String(req.body.displayName).trim();

    if (telegramChatId && telegramChatId.length > 64) {
        return res.status(400).json({
            success: false,
            message: "telegramChatId must be less than or equal to 64 characters.",
        });
    }

    if (displayName !== undefined && !displayName) {
        return res.status(400).json({
            success: false,
            message: "displayName must not be empty.",
        });
    }

    if (displayName && displayName.length > 80) {
        return res.status(400).json({
            success: false,
            message: "displayName must be less than or equal to 80 characters.",
        });
    }

    try {
        const updatedUser = await updateUserTelegramChatId(userId, {
            telegramChatId,
            displayName,
        });

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
            });
        }

        return res.json({
            success: true,
            message: "Profile updated successfully.",
            data: {
                id: updatedUser.id,
                displayName: updatedUser.displayName,
                username: updatedUser.username,
                role: updatedUser.role,
                telegramChatId: updatedUser.telegramChatId,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update profile.",
        });
    }
};

export { login, register, getProfile, updateProfile };
export { refreshToken, logout };
