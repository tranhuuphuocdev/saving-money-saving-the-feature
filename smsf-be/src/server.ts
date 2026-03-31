import config from "./config";
import { startNotificationCron, startNotificationTestCron } from "./jobs/notification.cron";

const PORT = config.port;

async function bootstrap() {
    const { default: app } = await import("./app");

    app.listen(PORT, () => {
        void startNotificationCron();
        // startNotificationTestCron();
        console.log(`
========================================
    Server is running on port ${PORT}
    Environment: ${config.nodeEnv}
    http://localhost:${PORT}/api/health
========================================
        `);
    });
}

bootstrap().catch((error: Error) => {
    console.error("Server bootstrap failed:", error.message);
    process.exit(1);
});
