import { Counter, Histogram } from "prom-client";
import prometheusRegistry from "./prometheus-registry";

class HttpMetricsService {
    private readonly requestCounter: Counter<string>;
    private readonly requestDuration: Histogram<string>;

    constructor() {
        const registry = prometheusRegistry.getRegistry();

        this.requestCounter = new Counter({
            name: "smsf_be_http_requests_total",
            help: "Total number of backend HTTP requests",
            labelNames: ["method", "route", "status_code"],
            registers: [registry],
        });

        this.requestDuration = new Histogram({
            name: "smsf_be_http_request_duration_seconds",
            help: "Duration of backend HTTP requests in seconds",
            labelNames: ["method", "route", "status_code"],
            buckets: [0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
            registers: [registry],
        });
    }

    public observeRequest(method: string, route: string, statusCode: number, duration_ms: number): void {
        const labels = {
            method: method.toUpperCase(),
            route,
            status_code: String(statusCode),
        };

        this.requestCounter.inc(labels, 1);
        this.requestDuration.observe(labels, Math.max(duration_ms, 0) / 1000);
    }
}

const httpMetricsService = new HttpMetricsService();

export default httpMetricsService;