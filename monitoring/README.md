# Monitoring Stack

This folder provides a common Loki + Promtail + Grafana setup that can be reused across services.

It also includes Pushgateway so locally running Node services can push metrics even when they are not running inside the Docker network.

## Start shared stack

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

## Required log layout for services

Promtail scrapes this host path pattern:

```text
../logs/<service-name>/*.log
```

Recommended service convention:

```text
logs/<service-name>/<service-name>.log
```

## Required JSON fields in each log line

- `service`
- `log_type`
- `level`
- `msg`
- `time`

## Pushgateway for local services

Prometheus scrapes Pushgateway at `pushgateway:9091` inside the monitoring compose stack.

Locally running services should push to:

```text
http://127.0.0.1:9091
```

Supported environment variables for service processes:

- `METRICS_PUSHGATEWAY_ENABLED` default `true`
- `PUSHGATEWAY_URL` default `http://127.0.0.1:9091`
- `PUSHGATEWAY_JOB_NAME` default service name such as `smsf-be`
- `PUSHGATEWAY_INSTANCE` optional stable instance label override
- `METRICS_PUSH_INTERVAL_MS` default `15000`
- `METRICS_PUSH_TIMEOUT_MS` default `5000`

With this convention, Grafana can filter by service and log type.
