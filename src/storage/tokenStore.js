//import * as SecureStore from "expo-secure-store";

//export const setTokens = async (a, r) => {
//  await SecureStore.setItemAsync("access", a);
//  await SecureStore.setItemAsync("refresh", r);
//};

//export const getAccessToken = () => SecureStore.getItemAsync("access");
//export const clearTokens = async () => {
//  await SecureStore.deleteItemAsync("access");
//  await SecureStore.deleteItemAsync("refresh");
//};


import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export async function setTokens(accessToken, refreshToken) {
    if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
        throw new Error("Tokens must be strings");
    }

    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function clearTokens() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
}
