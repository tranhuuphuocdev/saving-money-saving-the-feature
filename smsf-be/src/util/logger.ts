import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config';

const { combine, timestamp, printf, splat, json, colorize } = winston.format;
const DEFAULT_LOKI_LOG_DIR = 'logs';

const consoleFormat = printf(({ level, message, timestamp, service }) => {
    const serviceTag = service ? `[${service}]` : '';
    return `${timestamp} ${serviceTag} ${level}: ${message}`;
});

function createWinstonLogger(serviceName: string | null = null): winston.Logger {
    const transports: any[] = [
        new winston.transports.Console({
            level: config.logLevel,
            format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize({ all: true }), splat(), consoleFormat),
        }),
    ];

    const LOG_DIR = config.observability.logDir || DEFAULT_LOKI_LOG_DIR;
    if (LOG_DIR) {
        const logFileName = serviceName ? `${LOG_DIR}/${serviceName}-%DATE%.log` : `${LOG_DIR}/application-%DATE%.log`;

        const fileRotateTransport = new DailyRotateFile({
            filename: logFileName,
            datePattern: 'YYYY-MM-DD',
            maxFiles: 20,
            maxSize: '50m',
            level: config.logLevel,
            format: combine(timestamp(), splat(), json()),
        });

        transports.push(fileRotateTransport);
    }

    const winstonOptions: winston.LoggerOptions = {
        level: config.logLevel,
        defaultMeta: { service: serviceName || 'unknown-service' },
        transports,
    };

    return winston.createLogger(winstonOptions);
}

interface LoggerState {
    serviceName: string | null;
    instance: winston.Logger;
}

const state: LoggerState = {
    serviceName: null,
    instance: createWinstonLogger(null),
};

const logger = {
    setServiceName(serviceName: string) {
        state.serviceName = serviceName;
        state.instance = createWinstonLogger(serviceName);
    },

    logError: (message: string, ...meta: any[]) => {
        state.instance.error(message, ...meta);
    },

    logInfo: (message: string, ...meta: any[]) => {
        state.instance.info(message, ...meta);
    },

    logDebug: (message: string, ...meta: any[]) => {
        state.instance.debug(message, ...meta);
    },

    logWarn: (message: string, ...meta: any[]) => {
        state.instance.warn(message, ...meta);
    },

    getInstance: () => state.instance,
};

export default logger;
