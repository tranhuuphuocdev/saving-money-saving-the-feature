import dotenv from "dotenv";

dotenv.config();

const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
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
};

export default config;
