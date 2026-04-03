export interface IApiResponse<T = any> {
    data?: T;
    message?: string;
    errors?: string[];
}

export interface IApiError {
    message: string;
    statusCode: number;
    errors?: string[];
}
