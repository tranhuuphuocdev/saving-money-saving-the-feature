import { Pushgateway, type PrometheusContentType } from "prom-client";
import config from "../config";
import logger from "../util/logger";
import prometheusRegistry from "./prometheus-registry";

const pushgatewayConfig = config.observability.metrics.pushgateway;

let pushInterval: NodeJS.Timeout | undefined;
let pushGateway: Pushgateway<PrometheusContentType> | undefined;
let successLogged = false;
let started = false;
let cleanupRegistered = false;

const pushJob = async (): Promise<void> => {
    if (!pushGateway) {
        return;
    }

    try {
        await pushGateway.push({
            jobName: pushgatewayConfig.jobName,
            groupings: {
                instance: pushgatewayConfig.instance,
                env: config.nodeEnv,
            },
        });

        if (!successLogged) {
            logger.logInfo("Pushgateway metrics push enabled", {
                pushgatewayUrl: pushgatewayConfig.url,
                pushgatewayJobName: pushgatewayConfig.jobName,
                pushgatewayInstance: pushgatewayConfig.instance,
                pushIntervalMs: pushgatewayConfig.intervalMs,
            });
            successLogged = true;
        }
    } catch (error) {
        logger.logWarn("Failed to push metrics to Pushgateway", {
            pushgatewayUrl: pushgatewayConfig.url,
            pushgatewayJobName: pushgatewayConfig.jobName,
            pushgatewayInstance: pushgatewayConfig.instance,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
    }
};

const deleteJob = async (): Promise<void> => {
    if (!pushGateway) {
        return;
    }

    try {
        await pushGateway.delete({
            jobName: pushgatewayConfig.jobName,
            groupings: {
                instance: pushgatewayConfig.instance,
                env: config.nodeEnv,
            },
        });
    } catch (error) {
        logger.logWarn("Failed to delete metrics from Pushgateway during shutdown", {
            pushgatewayUrl: pushgatewayConfig.url,
            pushgatewayJobName: pushgatewayConfig.jobName,
            pushgatewayInstance: pushgatewayConfig.instance,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
    }
};

const stopBackendMetricsPush = async (): Promise<void> => {
    if (pushInterval) {
        clearInterval(pushInterval);
        pushInterval = undefined;
    }

    await deleteJob();
    started = false;
};

const registerCleanupHandlers = (): void => {
    if (cleanupRegistered) {
        return;
    }

    cleanupRegistered = true;

    const shutdown = (signal: string): void => {
        logger.logInfo("Stopping Pushgateway metrics push", { signal });
        void stopBackendMetricsPush().finally(() => {
            process.exit(0);
        });
    };

    process.once("SIGINT", () => {
        shutdown("SIGINT");
    });
    process.once("SIGTERM", () => {
        shutdown("SIGTERM");
    });
    process.once("beforeExit", () => {
        void stopBackendMetricsPush();
    });
};

const startBackendMetricsPush = async (): Promise<void> => {
    if (!pushgatewayConfig.enabled || started) {
        return;
    }

    pushGateway = new Pushgateway(pushgatewayConfig.url, {
        timeout: pushgatewayConfig.timeoutMs,
    }, prometheusRegistry.getRegistry());

    started = true;
    registerCleanupHandlers();

    await pushJob();

    pushInterval = setInterval(() => {
        void pushJob();
    }, pushgatewayConfig.intervalMs);
    pushInterval.unref?.();
};

export {
    startBackendMetricsPush,
    stopBackendMetricsPush,
};