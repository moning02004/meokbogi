export interface AuthTokenResponse {
    access_token: string;
    user_id: string;
}

export interface CheckAccountExistenceResponse {
    exists: boolean;
}
