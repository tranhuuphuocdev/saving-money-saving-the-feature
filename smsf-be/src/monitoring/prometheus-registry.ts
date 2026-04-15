import { Registry, collectDefaultMetrics } from "prom-client";

class PrometheusRegistry {
    private readonly registry: Registry;

    constructor() {
        this.registry = new Registry();
        collectDefaultMetrics({ register: this.registry, prefix: "smsf_be_" });
    }

    public getRegistry(): Registry {
        return this.registry;
    }

    public getContentType(): string {
        return this.registry.contentType;
    }

    public async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}

const prometheusRegistry = new PrometheusRegistry();

export default prometheusRegistry;