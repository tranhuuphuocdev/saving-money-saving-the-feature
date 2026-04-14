# Monitoring Stack

This folder provides a common Loki + Promtail + Grafana setup that can be reused across services.

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

With this convention, Grafana can filter by service and log type.
