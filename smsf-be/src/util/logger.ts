import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, splat, colorize } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, service, ...meta }) => {
    const serviceTag = service ? `[${service}]` : '';
    const serializedMeta = Object.keys(meta).length > 0
        ? ` ${JSON.stringify(meta)}`
        : '';

    return `${timestamp} ${serviceTag} ${level}: ${message}${serializedMeta}`;
});

function createWinstonLogger(serviceName: string | null = null): winston.Logger {
    const transports = [
        new winston.transports.Console({
            level: config.logLevel,
            format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize({ all: true }), splat(), consoleFormat),
        }),
    ];

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
