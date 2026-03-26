import dotenv from "dotenv";

dotenv.config();

const parseAllowedOrigins = (): string[] => {
    return String(process.env.CORS_ALLOWED_ORIGINS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
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
    ES_URL: process.env.ES_URL || "http://localhost:9200",
    ES_NAME_PREFIX: process.env.ES_NAME_PREFIX || "",
    ES_USERNAME: process.env.ES_USERNAME || "elastic",
    ES_PASSWORD: process.env.ES_PASSWORD || "yoimPhx0710!@",
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || "",
        defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
    },
    tracing: {
        enabled: process.env.TRACING_ENABLED !== "false",
        serviceName: process.env.OTEL_SERVICE_NAME || "smsf-be",
        otlpTraceUrl:
            process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
            "http://localhost:4318/v1/traces",
        debug: process.env.TRACING_DEBUG === "true",
    },
    loki: {
        LOKI_HOST: process.env.LOKI_HOST || "http://localhost:3100",
        LOKI_ENABLE: process.env.LOKI_ENABLE === "true",
        LOG_DIR: process.env.LOG_DIR || "/var/log/services/smsf-be",
    }
};

export default config;
