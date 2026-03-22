import { NextFunction, Request, Response } from "express";
import config from "../config";

/**
 * Middleware: API Version Control
 *
 * Checks if the requested API version is enabled via config.
 * Allows enabling/disabling specific versions via environment variables.
 *
 * Usage in .env:
 *   API_V1_ENABLED=true
 *   API_V2_ENABLED=true
 *   API_DEFAULT_VERSION=v1
 *
 * Rollback scenario:
 *   - v2 has bugs → set API_V2_ENABLED=false, API_DEFAULT_VERSION=v1
 *   - Redeploy → all /api/v2/* returns 503, /api/v1/* still works
 */
const versionGuard = (version: keyof typeof config.api.versions) => {
    return (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Response | void => {
        const isEnabled = config.api.versions[version];

        if (!isEnabled) {
            return res.status(503).json({
                success: false,
                message: `API ${version} is currently unavailable. Please use ${config.api.defaultVersion}.`,
                activeVersion: config.api.defaultVersion,
                suggestion: `/api/${config.api.defaultVersion}${req.path}`,
            });
        }

        // Attach version info to request
        req.apiVersion = version;
        next();
    };
};

/**
 * Middleware: Redirect unversioned /api/* requests to the default version
 */
const defaultVersionRedirect = (req: Request, res: Response): void => {
    const defaultVersion = config.api.defaultVersion;
    const newUrl = `/api/${defaultVersion}${req.path}`;

    res.redirect(307, newUrl);
};

export { versionGuard, defaultVersionRedirect };
