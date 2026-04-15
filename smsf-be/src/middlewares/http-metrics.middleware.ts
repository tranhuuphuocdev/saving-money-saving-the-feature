import { NextFunction, Request, Response } from "express";
import httpMetricsService from "../monitoring/http-metrics.service";

const resolveRouteLabel = (req: Request): string => {
    if (req.route?.path) {
        const path = String(req.route.path);
        return req.baseUrl ? `${req.baseUrl}${path}` : path;
    }

    return req.path || req.originalUrl || "unknown";
};

const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();

    res.on("finish", () => {
        httpMetricsService.observeRequest(
            req.method,
            resolveRouteLabel(req),
            res.statusCode,
            Date.now() - startedAt,
        );
    });

    next();
};

export default httpMetricsMiddleware;