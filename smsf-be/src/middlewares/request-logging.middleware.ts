import { NextFunction, Request, Response } from "express";
import logger from "../util/logger";
import { buildRequestContext } from "../util/api-logger";

const requestLoggingMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const startedAt = Date.now();

    res.on("finish", () => {
        logger.logInfo("HTTP request completed", buildRequestContext(req, {
            status_code: res.statusCode,
            duration_ms: Date.now() - startedAt,
            content_length: res.getHeader("content-length") ?? undefined,
        }));
    });

    next();
};

export default requestLoggingMiddleware;