const ACCESS_TOKEN_KEY = "jwt_token";

export function updateAccessToken(access: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
