import os from "os";
import dotenv from "dotenv";

dotenv.config();

const parseAllowedOrigins = (): string[] => {
    return String(process.env.CORS_ALLOWED_ORIGINS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const parseGoogleClientIds = (): string[] => {
    return String(process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (value === undefined) {
        return fallback;
    }

    return value === "true";
};

const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    api: {
        defaultVersion: process.env.API_DEFAULT_VERSION || "v1",
        versions: {
            v1: process.env.API_V1_ENABLED !== "false",
            v2: process.env.API_V2_ENABLED === "true",
        },
    },
    jwt: {
        secret: process.env.JWT_SECRET || "default-secret",
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        refreshSecret:
            process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },
    cors: {
        allowedOrigins: parseAllowedOrigins(),
    },
    authCookies: {
        accessTokenName: process.env.AUTH_ACCESS_COOKIE_NAME || "smsf_access",
        refreshTokenName: process.env.AUTH_REFRESH_COOKIE_NAME || "smsf_refresh",
        sameSite:
            (process.env.AUTH_COOKIE_SAME_SITE as
                | "lax"
                | "strict"
                | "none"
                | undefined) || "lax",
        secure:
            process.env.AUTH_COOKIE_SECURE === undefined
                ? process.env.NODE_ENV === "production"
                : process.env.AUTH_COOKIE_SECURE === "true",
        domain: process.env.AUTH_COOKIE_DOMAIN || "",
    },
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/smsf-db",
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || "",
        defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || "",
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 15000,
    },
    googleAuth: {
        clientIds: parseGoogleClientIds(),
    },
    r2: {
        endpoint: process.env.R2_ENDPOINT || "",
        bucketName: process.env.R2_BUCKET_NAME || "",
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || "",
        region: process.env.R2_REGION || "auto",
        enabled: parseBoolean(process.env.R2_ENABLED, false),
    },
    observability: {
        logDir: process.env.LOG_DIR || "/var/log/services",
        enableFileLog: parseBoolean(process.env.ENABLE_FILE_LOG, true),
        metrics: {
            pushgateway: {
                enabled: parseBoolean(process.env.METRICS_PUSHGATEWAY_ENABLED, true),
                url: process.env.PUSHGATEWAY_URL || "http://127.0.0.1:9091",
                jobName: process.env.PUSHGATEWAY_JOB_NAME || "smsf-be",
                instance:
                    process.env.PUSHGATEWAY_INSTANCE
                    || `${os.hostname()}:${Number(process.env.PORT) || 3000}`,
                intervalMs: Math.max(Number(process.env.METRICS_PUSH_INTERVAL_MS) || 15000, 5000),
                timeoutMs: Math.max(Number(process.env.METRICS_PUSH_TIMEOUT_MS) || 5000, 1000),
            },
        },
    },
};

export default config;
