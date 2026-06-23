// API_BASE_URL resolves from the EAS build profile env var, then falls back
// to __DEV__-based defaults so local dev works without any configuration.
const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

function resolveBaseUrl(): string {
    if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
    if (__DEV__) return "http://192.168.29.223:5263";
    return "https://apis.bseptechnologies.com";
}

export const API = {
    BASE_URL: resolveBaseUrl(),
    APP_ENV: (process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? "local" : "production")) as
        | "local"
        | "staging"
        | "production",
};

// Apple In-App Purchase product IDs — must match App Store Connect exactly.
export const IAP_SKUS = {
    WEEKLY:  process.env.EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID  ?? "com.bholeshankar.paperai.pro_weekly",
    MONTHLY: process.env.EXPO_PUBLIC_APPLE_MONTHLY_PRODUCT_ID ?? "com.bholeshankar.paperai.pro_monthly",
    YEARLY:  process.env.EXPO_PUBLIC_APPLE_YEARLY_PRODUCT_ID  ?? "com.bholeshankar.paperai.pro_yearly",
} as const;
