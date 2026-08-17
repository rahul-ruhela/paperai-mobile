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
import { LinearGradient } from "expo-linear-gradient";

import { verifyIosTransactionAutoWithRetry, getEntitlement } from "../api/billing";
import {
    recordFailedVerification,
    clearFailedVerification,
    wasPreviouslyUnverified,
} from "../storage/pendingPurchases";
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
    // A fetch has finished (successfully or not) — until then we show "Loading…"
    // rather than "Unavailable", so a slow StoreKit call doesn't look like a failure.
    const [fetchSettled, setFetchSettled] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);

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
        // StoreKit re-delivers unfinished transactions on every launch, so this
        // also runs for purchases whose verification failed on a previous run.
        // `finishTransaction` must stay behind a confirmed entitlement: leaving
        // the transaction open is what lets a failed purchase heal itself once
        // the backend is healthy again.
        onPurchaseSuccess: async (purchase) => {
            const transactionId = purchase?.transactionId;
            const productId = purchase?.productId ?? purchase?.id ?? null;
            const isReplay = await wasPreviouslyUnverified(transactionId);

            try {
                if (!transactionId) throw new Error("Missing transaction id");

                try {
                    await verifyIosTransactionAutoWithRetry(transactionId);
                } catch (verifyErr) {
                    // The server may have recorded the purchase and still failed
                    // the response. Ask what it actually believes before treating
                    // a paid-for subscription as failed.
                    const current = await loadEntitlement();
                    if (!entitlementIsActive(current)) throw verifyErr;
                    console.warn("[IAP] verify failed but entitlement is active — accepting.");
                }

                await finishTransaction({ purchase, isConsumable: false });
                await clearFailedVerification(transactionId);
                await loadEntitlement();

                Alert.alert("Subscribed!", "Your plan is now active. Thank you!", [
                    { text: "Continue", onPress: () => navigation.goBack() },
                ]);
            } catch (err) {
                console.warn(
                    "[IAP] verification failed",
                    `transactionId=${transactionId}`,
                    `status=${err?.response?.status ?? "none"}`,
                    `body=${JSON.stringify(err?.response?.data ?? null)}`
                );

                const isFirstFailure = await recordFailedVerification(transactionId, productId);

                // Only interrupt the user the first time. Later runs retry in the
                // background so a recovering backend activates the plan quietly
                // instead of greeting them with the same alert on every launch.
                if (isFirstFailure && !isReplay) {
                    Alert.alert(
                        "Activation pending",
                        "Your purchase went through and you have not been charged twice. We could not activate it just yet — we'll keep retrying automatically. If it hasn't activated shortly, tap \"Restore Purchases\" or contact support."
                    );
                }
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

    // NOTE: useIAP's fetchProducts resolves to `undefined` — it pushes its
    // results into the hook's `subscriptions` state instead of returning them.
    // The status therefore has to be derived from `subscriptions`; reading the
    // return value reports "error" even when the store is perfectly healthy.
    async function loadProducts() {
        setFetchSettled(false);
        setFetchFailed(false);
        try {
            await fetchProducts({ skus: ALL_SUBSCRIPTION_SKUS, type: "subs" });
        } catch (e) {
            console.warn("[IAP] fetchProducts failed:", e?.message ?? e);
            setFetchFailed(true);
        } finally {
            setFetchSettled(true);
        }
    }

    useEffect(() => {
        if (!connected) return;
        loadProducts();
    }, [connected]);

    const loadedSkus = new Set((subscriptions ?? []).map((p) => p.id));
    const missingCount = ALL_SUBSCRIPTION_SKUS.filter((sku) => !loadedSkus.has(sku)).length;

    // "loading" | "ready" | "partial" | "error" — drives the products banner.
    let productsStatus;
    if (missingCount === 0) productsStatus = "ready";
    else if (!fetchSettled) productsStatus = "loading";
    else if (loadedSkus.size === 0) productsStatus = "error";
    else productsStatus = "partial";

    useEffect(() => {
        if (!fetchSettled) return;
        const missing = ALL_SUBSCRIPTION_SKUS.filter((sku) => !loadedSkus.has(sku));
        if (missing.length > 0) {
            console.warn(
                `[IAP] StoreKit returned ${loadedSkus.size}/${ALL_SUBSCRIPTION_SKUS.length} SKUs.`,
                `Missing: ${missing.join(", ")}.`,
                fetchFailed ? "(fetchProducts threw)" : ""
            );
        }
    }, [fetchSettled, fetchFailed, missingCount]);

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

                                <GradientCTA
                                    onPress={() => onSubscribe(product.sku)}
                                    busy={isBusyThis}
                                    disabled={isActive || isBusyAny || priceUnavailable}
                                    label={
                                        isActive
                                            ? "ACTIVE PLAN"
                                            : priceUnavailable
                                            ? "UNAVAILABLE"
                                            : "Subscribe"
                                    }
                                />
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

// ── Subscription CTA — PaperAI blue gradient with gentle press animation ──────
function GradientCTA({ onPress, busy, disabled, label }) {
    const scale = useRef(new Animated.Value(1)).current;

    const pressIn = () =>
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 45, bounciness: 0 }).start();
    const pressOut = () =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 45, bounciness: 6 }).start();

    // Disabled (active plan / unavailable) → flat muted button, no glow.
    if (disabled && !busy) {
        return (
            <View
                style={[styles.cta, styles.ctaDisabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={label}
            >
                <Text style={styles.ctaText}>{label}</Text>
            </View>
        );
    }

    return (
        <Animated.View style={[styles.ctaGlow, { transform: [{ scale }] }]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={busy}
                activeOpacity={0.92}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <LinearGradient
                    colors={["#1D4ED8", "#2563EB", "#38BDF8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cta}
                >
                    {busy ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.ctaText}>{label}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 24 },
    header: { color: "#111111", fontSize: 28, fontWeight: "800", marginBottom: 6 },
    subHeader: { color: "#6B7280", fontSize: 14, marginBottom: 18 },
    notice: {
        color: "#B45309",
        backgroundColor: "rgba(245,158,11,0.12)",
        borderColor: "rgba(245,158,11,0.4)",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 18,
    },

    tabs: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.72)",
        borderColor: "#E5E7EB",
        borderWidth: 1,
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
    },
    tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", minHeight: 44, justifyContent: "center" },
    tabActive: { backgroundColor: "#4F8CFF" },
    tabText: { color: "#374151", fontWeight: "700", fontSize: 13 },
    tabTextActive: { color: "#FFFFFF" },

    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderColor: "rgba(255,255,255,0.90)",
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    cardHighlight: { borderColor: "#4F8CFF", backgroundColor: "rgba(79,140,255,0.08)" },
    cardActive: { borderColor: "#22C55E" },
    popular: {
        alignSelf: "flex-start",
        backgroundColor: "#FFD54A",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginBottom: 8,
    },
    popularText: { color: "#111111", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

    tierName: { color: "#111111", fontSize: 22, fontWeight: "800" },
    tierTagline: { color: "#6B7280", fontSize: 13, marginTop: 2, marginBottom: 12 },
    price: { color: "#111111", fontSize: 26, fontWeight: "800" },
    priceUnavailable: { color: "#6B7280", fontSize: 20, fontWeight: "700", fontStyle: "italic" },
    per: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
    credits: { color: "#2563EB", fontSize: 14, fontWeight: "700", marginTop: 4, marginBottom: 14 },

    cta: {
        borderRadius: 14,
        paddingVertical: 16,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    // Wrapper carries the rounded corners + subtle blue glow around the gradient.
    ctaGlow: {
        borderRadius: 14,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 6,
    },
    ctaDisabled: { backgroundColor: "#D1D5DB" },
    ctaText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },

    restore: {
        marginTop: 10,
        color: "#2563EB",
        textAlign: "center",
        textDecorationLine: "underline",
        fontSize: 14,
        fontWeight: "600",
    },
    legal: {
        marginTop: 20,
        color: "#6B7280",
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
        color: "#2563EB",
        fontSize: 12,
        fontWeight: "600",
        textDecorationLine: "underline",
    },
    legalLinkDot: { color: "#6B7280", fontSize: 12 },

    productsBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255,90,95,0.10)",
        borderColor: "rgba(255,90,95,0.4)",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
    },
    productsBannerText: {
        color: "#DC2626",
        fontSize: 12,
        fontWeight: "600",
        flex: 1,
        marginRight: 10,
    },
    productsBannerRetry: {
        color: "#DC2626",
        fontSize: 12,
        fontWeight: "800",
        textDecorationLine: "underline",
    },
});
