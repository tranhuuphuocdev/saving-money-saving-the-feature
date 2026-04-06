import { NextFunction, Request, Response } from "express";
import { logApiError } from "../util/api-logger";

/**
 * Middleware: Global error handler
 */
const errorHandler = (
    err: Error & { statusCode?: number },
    req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const statusCode = err.statusCode || 500;

    logApiError(req, "Unhandled API error", err, {
        statusCode,
    });

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

export default errorHandler;
