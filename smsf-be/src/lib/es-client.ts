import axios from "axios";
import config from "../config";

export const esClient = axios.create({
    baseURL: config.ES_URL,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json",
    },
});

export const withPrefix = (name: string): string => {
    return `${config.ES_NAME_PREFIX}${name}`;
};
