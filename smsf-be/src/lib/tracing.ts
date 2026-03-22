import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import config from "../config";

let sdkInstance: NodeSDK | null = null;

export async function startTracing(): Promise<void> {
    if (!config.tracing.enabled) {
        return;
    }

    if (sdkInstance) {
        return;
    }

    if (config.tracing.debug) {
        diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }

    const traceExporter = new OTLPTraceExporter({
        url: config.tracing.otlpTraceUrl,
    });

    const sdk = new NodeSDK({
        serviceName: config.tracing.serviceName,
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()],
    });

    await sdk.start();
    sdkInstance = sdk;

    process.on("SIGTERM", async () => {
        await stopTracing();
    });

    process.on("SIGINT", async () => {
        await stopTracing();
    });
}

export async function stopTracing(): Promise<void> {
    if (!sdkInstance) {
        return;
    }

    await sdkInstance.shutdown();
    sdkInstance = null;
}
