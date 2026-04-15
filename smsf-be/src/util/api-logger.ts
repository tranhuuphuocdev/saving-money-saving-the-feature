import { Request } from "express";
import logger from "./logger";

type TypeApiLogMeta = Record<string, unknown>;

const getRequestId = (req: Request): string | undefined => {
    const headerValue = req.headers["x-request-id"];
    if (Array.isArray(headerValue)) {
        return headerValue[0];
    }

    return typeof headerValue === "string" && headerValue.trim()
        ? headerValue.trim()
        : undefined;
};

const buildRequestContext = (
    req: Request,
    meta?: TypeApiLogMeta,
): TypeApiLogMeta => ({
    requestId: getRequestId(req),
    method: req.method,
    path: req.originalUrl,
    routePath: req.route?.path,
    userId: String(req.user?.id || "").trim() || undefined,
    username: String(req.user?.username || "").trim() || undefined,
    remote_addr: req.ip,
    params: Object.keys(req.params || {}).length > 0 ? req.params : undefined,
    query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
    bodyKeys:
        req.body && typeof req.body === "object"
            ? Object.keys(req.body).sort()
            : undefined,
    ...meta,
});

const toErrorMeta = (error: unknown): TypeApiLogMeta => {
    if (!(error instanceof Error)) {
        return {
            errorMessage: String(error),
        };
    }

    return {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        statusCode: (error as Error & { statusCode?: number }).statusCode,
    };
};

const logApiInfo = (
    req: Request,
    message: string,
    meta?: TypeApiLogMeta,
): void => {
    logger.logInfo(message, buildRequestContext(req, meta));
};

const logApiDebug = (
    req: Request,
    message: string,
    meta?: TypeApiLogMeta,
): void => {
    logger.logDebug(message, buildRequestContext(req, meta));
};

const logApiWarn = (
    req: Request,
    message: string,
    meta?: TypeApiLogMeta,
): void => {
    logger.logWarn(message, buildRequestContext(req, meta));
};

const logApiError = (
    req: Request,
    message: string,
    error: unknown,
    meta?: TypeApiLogMeta,
): void => {
    logger.logError(message, buildRequestContext(req, {
        ...meta,
        ...toErrorMeta(error),
    }));
};

export {
    buildRequestContext,
    getRequestId,
    logApiInfo,
    logApiDebug,
    logApiWarn,
    logApiError,
};