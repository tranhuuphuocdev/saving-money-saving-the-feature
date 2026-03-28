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
import { prisma } from "../lib/prisma";
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

const mapUserRow = (row: Record<string, unknown>): IUser => {
    return {
        id: String(row.id),
        displayName: String(row.displayName || row.username || row.id),
        username: String(row.username),
        password: String(row.password),
        role: row.role as IUser["role"],
        telegramChatId: row.telegramChat ? String(row.telegramChat) : undefined,
    };
};

const findUserByCredentials = async (
    username: string,
    password: string,
): Promise<IUser | undefined> => {
    const result = await prisma.user.findFirst({
        where: {
            username,
            password,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });
    return result ? mapUserRow(result as unknown as Record<string, unknown>) : undefined;
};

const findUserByUsername = async (username: string): Promise<IUser | undefined> => {
    const result = await prisma.user.findFirst({
        where: {
            username,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });
    return result ? mapUserRow(result as unknown as Record<string, unknown>) : undefined;
};

const usernameExists = async (username: string): Promise<boolean> => {
    const count = await prisma.user.count({
        where: { username },
    });

    return count > 0;
};

const hashPassword = (rawPassword: string): string => {
    return createHash("sha256").update(rawPassword).digest("hex");
};

const findUserById = async (userId: string): Promise<IUser | undefined> => {
    const result = await prisma.user.findFirst({
        where: {
            id: userId,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });
    return result ? mapUserRow(result as unknown as Record<string, unknown>) : undefined;
};

const createUserDocument = async (payload: IUserSource): Promise<void> => {
    await prisma.$executeRaw`
        INSERT INTO users (
            u_id,
            dn,
            username,
            tele_chat_id,
            password,
            role,
            created_at,
            updated_at,
            is_deleted
        ) VALUES (
            ${payload.uId}::uuid,
            ${payload.dn || payload.username},
            ${payload.username},
            ${payload.teleChatId || null},
            ${payload.password},
            ${payload.role},
            ${BigInt(payload.createdAt || Date.now())},
            ${BigInt(payload.updatedAt || Date.now())},
            ${payload.isDeleted ?? false}
        )
    `;
};

const updateUserTelegramChatId = async (
    userId: string,
    payload: {
        telegramChatId?: string;
        displayName?: string;
    },
): Promise<IUser | undefined> => {
    const existing = await prisma.user.findFirst({
        where: {
            id: userId,
            isDeleted: false,
        },
        orderBy: { updatedAt: "desc" },
    });

    if (!existing) {
        return undefined;
    }

    const updatedResult = await prisma.user.update({
        where: { id: userId },
        data: {
            telegramChat: payload.telegramChatId ?? "",
            displayName: payload.displayName || existing.displayName || existing.username,
            updatedAt: BigInt(Date.now()),
        },
    });

    return mapUserRow(updatedResult as unknown as Record<string, unknown>);
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

        const existingUsername = await usernameExists(safeUsername);
        if (existingUsername) {
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
        console.error("Register failed:", error);

        const detailedMessage =
            error instanceof Error ? error.message : "Unknown error.";

        return res.status(500).json({
            success: false,
            message:
                config.nodeEnv === "production"
                    ? "Register failed."
                    : `Register failed: ${detailedMessage}`,
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
