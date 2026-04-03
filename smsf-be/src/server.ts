import config from "./config";
import { startNotificationCron, startNotificationTestCron } from "./jobs/notification.cron";
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = config.port;

async function bootstrap() {
    const { default: app } = await import("./app");
    const { initializeSocket } = await import("./lib/socket");

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        path: "/api/socket.io",
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3033",
            credentials: true,
        },
    });

    // Initialize Socket.io handlers
    initializeSocket(io);

    httpServer.listen(PORT, () => {
        void startNotificationCron();
        // startNotificationTestCron();
        console.log(`
========================================
    Server is running on port ${PORT}
    Environment: ${config.nodeEnv}
    http://localhost:${PORT}/api/health
    WebSocket: ws://localhost:${PORT}/api/socket.io
========================================
        `);
    });
}

bootstrap().catch((error: Error) => {
    console.error("Server bootstrap failed:", error.message);
    process.exit(1);
});
