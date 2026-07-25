// API_BASE_URL resolves from the EAS build profile env var, then falls back
// to __DEV__-based defaults so local dev works without any configuration.
const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

function resolveBaseUrl(): string {
    if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
    // Default to the LIVE API in every environment so the app never silently
    // hits a stale LAN IP. To use a local backend, set EXPO_PUBLIC_API_BASE_URL
    // (e.g. in .env.local) to your machine's LAN IP.
    return "http://192.168.29.223:5263";
}

export const API = {
    BASE_URL: resolveBaseUrl(),
    APP_ENV: (process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? "local" : "production")) as
        | "local"
        | "staging"
        | "production",
};

// ---------------------------------------------------------------------------
// Apple In-App Purchase — 3 tiers (Essential / Plus / Advance) × 3 durations.
// Product IDs MUST match App Store Connect exactly. Prices + per-territory
// pricing + intro/offer codes are configured in App Store Connect; the app only
// needs the IDs + credits. The live Apple price is shown when available, falling
// back to the static price below.
// ---------------------------------------------------------------------------
const BID = "com.bholeshankar.paperai";

export type SubscriptionDuration = "weekly" | "monthly" | "yearly";
export type SubscriptionTierId = "essential" | "plus" | "advance";

export interface TierProduct {
    sku: string;
    credits: number;
    fallbackPrice: string; // shown only if Apple hasn't returned a live price yet
}

export interface SubscriptionTier {
    id: SubscriptionTierId;
    name: string;
    tagline: string;
    highlight?: boolean;
    products: Record<SubscriptionDuration, TierProduct>;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
    {
        id: "essential",
        name: "Essential",
        tagline: "For getting started",
        products: {
            weekly:  { sku: `${BID}.essential_weekly`,  credits: 15,  fallbackPrice: "$15.99" },
            monthly: { sku: `${BID}.essential_monthly`, credits: 60,  fallbackPrice: "$57.90" },
            yearly:  { sku: `${BID}.essential_yearly`,  credits: 560, fallbackPrice: "$459.00" },
        },
    },
    {
        id: "plus",
        name: "Plus",
        tagline: "Most popular",
        highlight: true,
        products: {
            weekly:  { sku: `${BID}.plus_weekly`,  credits: 40,  fallbackPrice: "$42.49" },
            monthly: { sku: `${BID}.plus_monthly`, credits: 160, fallbackPrice: "$153.99" },
            yearly:  { sku: `${BID}.plus_yearly`,  credits: 850, fallbackPrice: "$699.00" },
        },
    },
    {
        id: "advance",
        name: "Advance",
        tagline: "Maximum power",
        products: {
            weekly:  { sku: `${BID}.advance_weekly`,  credits: 80,   fallbackPrice: "$85.00" },
            monthly: { sku: `${BID}.advance_monthly`, credits: 320,  fallbackPrice: "$309.00" },
            yearly:  { sku: `${BID}.advance_yearly`,  credits: 1100, fallbackPrice: "$899.00" },
        },
    },
];

export const DURATION_LABELS: Record<SubscriptionDuration, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
};

// Flat list of every product id — used for the StoreKit product fetch.
export const ALL_SUBSCRIPTION_SKUS: string[] = SUBSCRIPTION_TIERS.flatMap((t) =>
    Object.values(t.products).map((p) => p.sku)
);

// Look up the tier + credits for a purchased product id (for the success UI).
export function productInfoForSku(sku: string):
    | { tier: SubscriptionTier; duration: SubscriptionDuration; product: TierProduct }
    | null {
    for (const tier of SUBSCRIPTION_TIERS) {
        for (const duration of Object.keys(tier.products) as SubscriptionDuration[]) {
            const product = tier.products[duration];
            if (product.sku === sku) return { tier, duration, product };
        }
    }
    return null;
}
