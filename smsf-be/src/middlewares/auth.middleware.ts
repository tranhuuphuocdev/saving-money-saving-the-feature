import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import { isTokenBlacklisted } from "../lib/auth-token-store";

/**
 * Middleware: Verify JWT token from Authorization header
 * Format: Bearer <token>
 */
const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
): Response | void => {
    try {
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.[config.authCookies.accessTokenName] as
            | string
            | undefined;

        let token = cookieToken;

        if (!token && authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided.",
            });
        }

        if (isTokenBlacklisted(token)) {
            return res.status(401).json({
                success: false,
                message: "Token is blacklisted. Please login again.",
            });
        }

        const decoded = jwt.verify(token, config.jwt.secret);

        if (typeof decoded === "string") {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload.",
            });
        }

        // Attach user info to request
        req.user = decoded as JwtPayload;
        req.accessToken = token;
        next();
    } catch (error) {
        if ((error as Error).name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token has expired.",
            });
        }

        return res.status(401).json({
            success: false,
            message: "Invalid token.",
        });
    }
};

export default authMiddleware;
