import config from "./config";
import { startTracing } from "./lib/tracing";

const PORT = config.port;

async function bootstrap() {
    await startTracing();
    const { default: app } = await import("./app");

    app.listen(PORT, () => {
        console.log(`
========================================
    Server is running on port ${PORT}
    Environment: ${config.nodeEnv}
    http://localhost:${PORT}/api/health
    Tracing: ${config.tracing.enabled ? "enabled" : "disabled"}
========================================
        `);
    });
}

bootstrap().catch((error: Error) => {
    console.error("Server bootstrap failed:", error.message);
    process.exit(1);
});
