/**
 * PaywallScreen — 3-tier Apple subscriptions (Essential / Plus / Advance),
 * each with Weekly / Monthly / Yearly, via real StoreKit 2 (expo-iap).
 *
 * Flow (in a real build — dev-client / TestFlight / App Store):
 *   1. Connect to the App Store, fetch all 9 products.
 *   2. User picks a duration tab, taps a tier → requestPurchase opens Apple's sheet.
 *   3. On success → verify transactionId against /api/billing/ios/verify-transaction-auto
 *      → finishTransaction → refresh the server entitlement.
 *
 * Expo Go: the expo-iap native module doesn't exist there, so we render a
 * read-only version (no crash) — keeps `expo start` working on any OS.
 */

import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Animated,
    ScrollView,
} from "react-native";
import Constants from "expo-constants";

import { verifyIosTransactionAuto, getEntitlement } from "../api/billing";
import {
    SUBSCRIPTION_TIERS,
    DURATION_LABELS,
    ALL_SUBSCRIPTION_SKUS,
} from "../constants/api";
import ScreenContainer from "../ui/ScreenContainer";

// "storeClient" === running inside Expo Go, where native modules are unavailable.
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

const DURATIONS = ["weekly", "monthly", "yearly"];

// Backend may return either `active` or `isActive` — accept both.
function entitlementIsActive(e) {
    return !!(e?.active ?? e?.isActive);
}

/* =========================================================================
   Public component — picks the right implementation for the environment.
========================================================================= */
export default function PaywallScreen(props) {
    if (IS_EXPO_GO) return <PaywallExpoGo {...props} />;
    return <PaywallNative {...props} />;
}

/* =========================================================================
   Real purchases (expo-iap) — dev-client / TestFlight / App Store.
========================================================================= */
function PaywallNative({ navigation }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useIAP } = require("expo-iap");

    const [loadingSku, setLoadingSku] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [duration, setDuration] = useState("yearly");
    // "loading" | "ready" | "partial" | "error" — drives the products banner.
    const [productsStatus, setProductsStatus] = useState("loading");

    async function loadEntitlement() {
        try {
            const e = await getEntitlement();
            setEntitlement(e);
            return e;
        } catch {
            return null;
        }
    }

    const {
        connected,
        subscriptions,
        fetchProducts,
        requestPurchase,
        finishTransaction,
        restorePurchases,
    } = useIAP({
        onPurchaseSuccess: async (purchase) => {
            try {
                const transactionId = purchase?.transactionId;
                if (!transactionId) throw new Error("Missing transaction id");
                await verifyIosTransactionAuto(transactionId);
                await finishTransaction({ purchase, isConsumable: false });
                await loadEntitlement();
                Alert.alert("Subscribed!", "Your plan is now active. Thank you!", [
                    { text: "Continue", onPress: () => navigation.goBack() },
                ]);
            } catch (err) {
                Alert.alert(
                    "Verification failed",
                    err?.userMessage ??
                        'Your purchase went through but we could not activate it. Tap "Restore Purchases" or contact support.'
                );
            } finally {
                setLoadingSku(null);
            }
        },
        onPurchaseError: (error) => {
            setLoadingSku(null);
            const code = error?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", error?.message ?? "Please try again.");
        },
        onError: (error) => console.warn("[IAP]", error?.message ?? error),
    });

    useEffect(() => {
        loadEntitlement();
    }, []);

    async function loadProducts() {
        setProductsStatus("loading");
        try {
            const result = await fetchProducts({ skus: ALL_SUBSCRIPTION_SKUS, type: "subs" });
            const returned = Array.isArray(result) ? result : [];
            const returnedIds = new Set(returned.map((p) => p.id));
            const missing = ALL_SUBSCRIPTION_SKUS.filter((sku) => !returnedIds.has(sku));
            if (missing.length > 0) {
                console.warn("[IAP] StoreKit did not return these SKUs:", missing.join(", "));
            }
            setProductsStatus(
                returned.length === 0 ? "error" : missing.length > 0 ? "partial" : "ready"
            );
        } catch (e) {
            console.warn("[IAP] fetchProducts failed:", e?.message ?? e);
            setProductsStatus("error");
        }
    }

    useEffect(() => {
        if (!connected) return;
        loadProducts();
    }, [connected]);

    async function subscribe(sku) {
        if (loadingSku) return;
        if (!connected) {
            Alert.alert("Store unavailable", "Could not reach the App Store. Please try again in a moment.");
            return;
        }
        if (!priceForSku(sku)) {
            Alert.alert(
                "Plan unavailable",
                "This plan could not be loaded from the App Store right now. Please try again in a moment."
            );
            return;
        }
        setLoadingSku(sku);
        try {
            await requestPurchase({ request: { apple: { sku } }, type: "subs" });
        } catch (e) {
            setLoadingSku(null);
            const code = e?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", e?.message ?? "Please try again.");
        }
    }

    async function restore() {
        if (loadingSku) return;
        setLoadingSku("__restore__");
        try {
            await restorePurchases();
            const e = await loadEntitlement();
            if (entitlementIsActive(e)) {
                Alert.alert("Restored", "Your subscription is active.", [
                    { text: "OK", onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert("Nothing to restore", "No active subscription found for this Apple ID.");
            }
        } catch (e) {
            Alert.alert("Restore failed", e?.userMessage ?? e?.message ?? "Please try again.");
        } finally {
            setLoadingSku(null);
        }
    }

    // Only ever show the live App Store price. A product StoreKit didn't
    // return renders as unavailable (never a fabricated static price).
    function priceForSku(sku) {
        const product = subscriptions?.find((p) => p.id === sku);
        return product?.displayPrice ?? null;
    }

    return (
        <PaywallView
            duration={duration}
            setDuration={setDuration}
            entitlement={entitlement}
            loadingSku={loadingSku}
            productsStatus={productsStatus}
            onRetryProducts={loadProducts}
            priceForSku={priceForSku}
            onSubscribe={subscribe}
            onRestore={restore}
            onOpenTerms={() => navigation.navigate("Terms")}
            onOpenPrivacy={() => navigation.navigate("Privacy")}
        />
    );
}

/* =========================================================================
   Expo Go fallback — read-only, no native module, never crashes.
========================================================================= */
function PaywallExpoGo({ navigation }) {
    const [entitlement, setEntitlement] = useState(null);
    const [duration, setDuration] = useState("yearly");

    useEffect(() => {
        (async () => {
            try {
                setEntitlement(await getEntitlement());
            } catch {
                /* ignore */
            }
        })();
    }, []);

    function notifyUnavailable() {
        Alert.alert(
            "Not available in Expo Go",
            "In-app purchases need the full app build (TestFlight / App Store or an EAS dev build)."
        );
    }

    return (
        <PaywallView
            duration={duration}
            setDuration={setDuration}
            entitlement={entitlement}
            loadingSku={null}
            notice="You're in Expo Go — purchasing is disabled here. Use a TestFlight / App Store build to subscribe."
            productsStatus="ready"
            priceForSku={(sku, fallback) => fallback ?? null}
            onSubscribe={notifyUnavailable}
            onRestore={notifyUnavailable}
            onOpenTerms={() => navigation.navigate("Terms")}
            onOpenPrivacy={() => navigation.navigate("Privacy")}
        />
    );
}

/* =========================================================================
   Shared presentational view (duration tabs + 3 tier cards).
========================================================================= */
function PaywallView({
    duration,
    setDuration,
    entitlement,
    loadingSku,
    notice,
    productsStatus = "ready",
    onRetryProducts,
    priceForSku,
    onSubscribe,
    onRestore,
    onOpenTerms,
    onOpenPrivacy,
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const isBusyAny = !!loadingSku;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    return (
        <ScreenContainer>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <Text style={styles.header}>Choose your plan</Text>
                <Text style={styles.subHeader}>
                    Credits power document scanning, OCR and AI analysis, and refresh with every
                    renewal. Cancel anytime in App Store settings.
                </Text>

                {!!notice && <Text style={styles.notice}>{notice}</Text>}

                {(productsStatus === "error" || productsStatus === "partial") && (
                    <View style={styles.productsBanner}>
                        <Text style={styles.productsBannerText}>
                            {productsStatus === "error"
                                ? "Plans could not be loaded from the App Store."
                                : "Some plans are unavailable right now."}
                        </Text>
                        {!!onRetryProducts && (
                            <TouchableOpacity onPress={onRetryProducts} activeOpacity={0.8}>
                                <Text style={styles.productsBannerRetry}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Duration tabs */}
                <View style={styles.tabs}>
                    {DURATIONS.map((d) => {
                        const active = duration === d;
                        return (
                            <TouchableOpacity
                                key={d}
                                onPress={() => setDuration(d)}
                                style={[styles.tab, active && styles.tabActive]}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                    {DURATION_LABELS[d]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Tier cards */}
                {SUBSCRIPTION_TIERS.map((tier) => {
                    const product = tier.products[duration];
                    const livePrice = priceForSku(product.sku, product.fallbackPrice);
                    const priceUnavailable = livePrice == null;
                    const isActive =
                        entitlementIsActive(entitlement) &&
                        entitlement.productId === product.sku;
                    const isBusyThis = loadingSku === product.sku;
                    const Wrapper = tier.highlight ? Animated.View : View;
                    const wrapperStyle = tier.highlight ? { transform: [{ scale: scaleAnim }] } : null;

                    return (
                        <Wrapper key={tier.id} style={wrapperStyle}>
                            <View
                                style={[
                                    styles.card,
                                    tier.highlight && styles.cardHighlight,
                                    isActive && styles.cardActive,
                                ]}
                            >
                                {tier.highlight && (
                                    <View style={styles.popular}>
                                        <Text style={styles.popularText}>MOST POPULAR</Text>
                                    </View>
                                )}

                                <Text style={styles.tierName}>{tier.name}</Text>
                                <Text style={styles.tierTagline}>{tier.tagline}</Text>

                                {priceUnavailable ? (
                                    <Text style={styles.priceUnavailable}>
                                        {productsStatus === "loading" ? "Loading price…" : "Unavailable"}
                                    </Text>
                                ) : (
                                    <Text style={styles.price}>
                                        {livePrice}
                                        <Text style={styles.per}> / {duration.replace("ly", "")}</Text>
                                    </Text>
                                )}
                                <Text style={styles.credits}>{product.credits} credits / cycle</Text>

                                <TouchableOpacity
                                    onPress={() => onSubscribe(product.sku)}
                                    disabled={isActive || isBusyAny || priceUnavailable}
                                    activeOpacity={0.9}
                                    style={[
                                        styles.cta,
                                        tier.highlight && styles.ctaHighlight,
                                        (isActive || isBusyAny || priceUnavailable) && styles.ctaDisabled,
                                    ]}
                                >
                                    {isBusyThis ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.ctaText}>
                                            {isActive
                                                ? "ACTIVE PLAN"
                                                : priceUnavailable
                                                ? "UNAVAILABLE"
                                                : "Subscribe"}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Wrapper>
                    );
                })}

                <TouchableOpacity
                    onPress={onRestore}
                    disabled={isBusyAny}
                    style={{ opacity: isBusyAny ? 0.5 : 1 }}
                >
                    <Text style={styles.restore}>
                        {loadingSku === "__restore__" ? "Restoring…" : "Restore Purchases"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.legal}>
                    Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
                    current period. Manage or cancel in App Store › Account › Subscriptions. Payment is
                    charged to your Apple ID at confirmation of purchase.
                </Text>

                <View style={styles.legalLinks}>
                    <TouchableOpacity onPress={onOpenTerms}>
                        <Text style={styles.legalLink}>Terms of Use</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalLinkDot}>·</Text>
                    <TouchableOpacity onPress={onOpenPrivacy}>
                        <Text style={styles.legalLink}>Privacy Policy</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 24, backgroundColor: "#020617" },
    header: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 6 },
    subHeader: { color: "#94a3b8", fontSize: 14, marginBottom: 18 },
    notice: {
        color: "#fbbf24",
        backgroundColor: "rgba(251,191,36,0.10)",
        borderColor: "rgba(251,191,36,0.35)",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 18,
    },

    tabs: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
    tabActive: { backgroundColor: "#6366f1" },
    tabText: { color: "#94a3b8", fontWeight: "800", fontSize: 13 },
    tabTextActive: { color: "#fff" },

    card: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderColor: "rgba(255,255,255,0.10)",
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
    },
    cardHighlight: { borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.10)" },
    cardActive: { borderColor: "#22c55e" },
    popular: {
        alignSelf: "flex-start",
        backgroundColor: "#6366f1",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginBottom: 8,
    },
    popularText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

    tierName: { color: "#fff", fontSize: 22, fontWeight: "900" },
    tierTagline: { color: "#94a3b8", fontSize: 13, marginTop: 2, marginBottom: 12 },
    price: { color: "#fff", fontSize: 26, fontWeight: "900" },
    priceUnavailable: { color: "#64748b", fontSize: 20, fontWeight: "800", fontStyle: "italic" },
    per: { color: "#94a3b8", fontSize: 14, fontWeight: "700" },
    credits: { color: "#A5B4FC", fontSize: 14, fontWeight: "700", marginTop: 4, marginBottom: 14 },

    cta: {
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: "center",
    },
    ctaHighlight: { backgroundColor: "#6366f1" },
    ctaDisabled: { opacity: 0.55 },
    ctaText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    restore: {
        marginTop: 10,
        color: "#94a3b8",
        textAlign: "center",
        textDecorationLine: "underline",
        fontSize: 14,
    },
    legal: {
        marginTop: 20,
        color: "#475569",
        fontSize: 11,
        textAlign: "center",
        lineHeight: 16,
    },
    legalLinks: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
        paddingBottom: 40,
        gap: 8,
    },
    legalLink: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "700",
        textDecorationLine: "underline",
    },
    legalLinkDot: { color: "#475569", fontSize: 12 },

    productsBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(239,68,68,0.10)",
        borderColor: "rgba(239,68,68,0.35)",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
    },
    productsBannerText: {
        color: "#fca5a5",
        fontSize: 12,
        fontWeight: "700",
        flex: 1,
        marginRight: 10,
    },
    productsBannerRetry: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
        textDecorationLine: "underline",
    },
});
