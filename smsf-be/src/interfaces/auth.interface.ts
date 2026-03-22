import { JwtPayload } from "jsonwebtoken";
import { TypeJwtTokenKind, TypeUserRole } from "../types/auth.type";

export interface IUser {
    id: string;
    username: string;
    password: string;
    role: TypeUserRole;
}

export interface ILoginPayload {
    username?: string;
    password?: string;
}

export interface IRefreshTokenPayloadRequest {
    refreshToken?: string;
}

export interface ILogoutPayloadRequest {
    refreshToken?: string;
}

export interface IJwtAuthPayload extends JwtPayload {
    id: string;
    username: string;
    role: TypeUserRole;
    tokenType: TypeJwtTokenKind;
}

