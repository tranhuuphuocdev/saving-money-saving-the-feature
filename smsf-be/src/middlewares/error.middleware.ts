import { NextFunction, Request, Response } from "express";

/**
 * Middleware: Global error handler
 */
const errorHandler = (
    err: Error & { statusCode?: number },
    req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    console.error(`[Error] ${err.message}`);
    console.error(err.stack);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

export default errorHandler;
