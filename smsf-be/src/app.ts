import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import config from "./config";
import routes from "./routes";
import prometheusRegistry from "./monitoring/prometheus-registry";
import logger from "./util/logger";
import { errorHandler, httpMetricsMiddleware, requestLoggingMiddleware } from "./middlewares";

const app = express();

logger.setServiceName("smsf-be");

app.disable("x-powered-by");
// Running behind nginx/gateway, trust the first upstream proxy for client IP.
// if (config.nodeEnv === "production") {
//     app.set("trust proxy", 1);
// }
app.set("trust proxy", 1);

const allowAllOrigins = config.cors.allowedOrigins.length === 0;

// --- Global Middlewares ---
app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowAllOrigins || config.cors.allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error("Origin is not allowed by CORS policy."));
        },
        credentials: true,
    }),
);
app.use(
    helmet({
        crossOriginResourcePolicy: false,
    }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(httpMetricsMiddleware);
app.use(requestLoggingMiddleware);

app.get("/metrics", async (_req: Request, res: Response) => {
    res.setHeader("Content-Type", prometheusRegistry.getContentType());
    res.send(await prometheusRegistry.getMetrics());
});

// --- Routes ---
app.use("/api", routes);

// --- 404 Handler ---
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// --- Error Handler ---
app.use(errorHandler);

export default app;
