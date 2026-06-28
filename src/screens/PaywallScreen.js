/**
 * PaywallScreen — real Apple In-App Purchase flow (StoreKit 2 via expo-iap).
 *
 * Flow (in a real build — TestFlight / App Store / dev-client):
 *   1. Connect to the App Store and fetch the live subscription products.
 *   2. User taps a plan → requestPurchase() opens the native Apple sheet.
 *   3. On success → verify the StoreKit 2 transactionId against our backend
 *      (/api/billing/ios/verify-transaction-auto), then finishTransaction().
 *   4. Reload the server-side entitlement to reflect the new state.
 *
 * Expo Go: the `expo-iap` native module does not exist there, so calling the
 * purchase hook would crash. We detect Expo Go and render a read-only fallback
 * that still shows the plans + current entitlement, with a clear notice that
 * purchasing requires the full build. This keeps `expo start` working on any OS
 * (Windows / macOS / Linux) for everyday development.
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
import { IAP_SKUS } from "../constants/api";
import SubscriptionPlanCard from "../ui/SubscriptionPlanCard";
import ScreenContainer from "../ui/ScreenContainer";

// "storeClient" === running inside Expo Go, where native modules are unavailable.
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

const SUBSCRIPTION_SKUS = [IAP_SKUS.WEEKLY, IAP_SKUS.MONTHLY, IAP_SKUS.YEARLY];

const PLANS = [
    {
        id: "weekly",
        productId: IAP_SKUS.WEEKLY,
        title: "Weekly",
        price: "$8.99 / week",
    },
    {
        id: "monthly",
        productId: IAP_SKUS.MONTHLY,
        title: "Monthly",
        price: "$29.90 / month",
        badge: "16.6% OFF",
    },
    {
        id: "yearly",
        productId: IAP_SKUS.YEARLY,
        title: "Yearly",
        price: "$279 / year",
        badge: "40% OFF · Best Value",
        highlight: true,
    },
];

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
   Real purchases (expo-iap) — used in dev-client / TestFlight / App Store.
   useIAP is required lazily so the native module is never touched in Expo Go.
========================================================================= */
function PaywallNative({ navigation }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useIAP } = require("expo-iap");

    const [loadingProductId, setLoadingProductId] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [selectedPlanId, setSelectedPlanId] = useState("yearly");

    const scaleAnim = useRef(new Animated.Value(1)).current;

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
        // Fired by StoreKit when a purchase (or restore) completes.
        onPurchaseSuccess: async (purchase) => {
            try {
                const transactionId = purchase?.transactionId;
                if (!transactionId) throw new Error("Missing transaction id");

                // Verify with our backend (auto-detects sandbox vs production).
                await verifyIosTransactionAuto(transactionId);

                // Tell StoreKit the transaction is fulfilled so it stops replaying.
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
                setLoadingProductId(null);
            }
        },
        onPurchaseError: (error) => {
            setLoadingProductId(null);
            const code = error?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", error?.message ?? "Please try again.");
        },
        onError: (error) => {
            console.warn("[IAP]", error?.message ?? error);
        },
    });

    // Load server entitlement + start the highlight pulse once.
    useEffect(() => {
        loadEntitlement();

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    // Fetch live products once the store connection is ready.
    useEffect(() => {
        if (!connected) return;
        fetchProducts({ skus: SUBSCRIPTION_SKUS, type: "subs" }).catch(() => {});
    }, [connected]);

    async function subscribe(plan) {
        if (loadingProductId) return;
        if (!connected) {
            Alert.alert("Store unavailable", "Could not reach the App Store. Please try again in a moment.");
            return;
        }
        setLoadingProductId(plan.productId);
        try {
            // Opens the native Apple purchase sheet. Result arrives via the
            // onPurchaseSuccess / onPurchaseError callbacks above.
            await requestPurchase({
                request: { apple: { sku: plan.productId } },
                type: "subs",
            });
        } catch (e) {
            setLoadingProductId(null);
            const code = e?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", e?.message ?? "Please try again.");
        }
    }

    async function restore() {
        if (loadingProductId) return;
        setLoadingProductId("__restore__");
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
            setLoadingProductId(null);
        }
    }

    // Prefer the live App Store price when available, falling back to static copy.
    function priceForPlan(plan) {
        const product = subscriptions?.find((p) => p.id === plan.productId);
        return product?.displayPrice ?? plan.price;
    }

    return (
        <PaywallView
            scaleAnim={scaleAnim}
            entitlement={entitlement}
            selectedPlanId={selectedPlanId}
            loadingProductId={loadingProductId}
            priceForPlan={priceForPlan}
            onSelectPlan={(plan) => {
                setSelectedPlanId(plan.id);
                subscribe(plan);
            }}
            onRestore={restore}
        />
    );
}

/* =========================================================================
   Expo Go fallback — no native module. Read-only: shows plans + status and
   explains that purchasing needs the full build. Never crashes.
========================================================================= */
function PaywallExpoGo({ navigation }) {
    const [entitlement, setEntitlement] = useState(null);
    const [selectedPlanId, setSelectedPlanId] = useState("yearly");
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        (async () => {
            try {
                setEntitlement(await getEntitlement());
            } catch {
                /* ignore */
            }
        })();

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    function notifyUnavailable() {
        Alert.alert(
            "Not available in Expo Go",
            "In-app purchases need the full app build (TestFlight or App Store, or an EAS dev build). Open the Paywall there to subscribe."
        );
    }

    return (
        <PaywallView
            scaleAnim={scaleAnim}
            entitlement={entitlement}
            selectedPlanId={selectedPlanId}
            loadingProductId={null}
            notice="You're in Expo Go — purchasing is disabled here. Use a TestFlight / App Store build to subscribe."
            priceForPlan={(plan) => plan.price}
            onSelectPlan={(plan) => {
                setSelectedPlanId(plan.id);
                notifyUnavailable();
            }}
            onRestore={notifyUnavailable}
        />
    );
}

/* =========================================================================
   Shared presentational view used by both implementations.
========================================================================= */
function PaywallView({
    scaleAnim,
    entitlement,
    selectedPlanId,
    loadingProductId,
    notice,
    priceForPlan,
    onSelectPlan,
    onRestore,
}) {
    const isBusyAny = !!loadingProductId;

    return (
        <ScreenContainer>
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.header}>Upgrade to AI Pro</Text>
                <Text style={styles.subHeader}>
                    Pick a plan. Cancel anytime from App Store settings.
                </Text>

                {!!notice && <Text style={styles.notice}>{notice}</Text>}

                {PLANS.map((plan) => {
                    const isActive =
                        entitlementIsActive(entitlement) &&
                        entitlement.productId === plan.productId;
                    const isBusyThisPlan = loadingProductId === plan.productId;
                    const isSelected = selectedPlanId === plan.id;
                    const Wrapper = plan.highlight ? Animated.View : View;
                    const wrapperStyle = plan.highlight
                        ? { transform: [{ scale: scaleAnim }] }
                        : null;

                    return (
                        <TouchableOpacity
                            key={plan.productId}
                            activeOpacity={0.9}
                            disabled={isActive || isBusyAny}
                            onPress={() => onSelectPlan(plan)}
                            style={{ marginBottom: 16 }}
                        >
                            <Wrapper style={wrapperStyle}>
                                <SubscriptionPlanCard
                                    title={plan.title}
                                    price={priceForPlan(plan)}
                                    badge={plan.badge}
                                    highlight={plan.highlight}
                                    selected={isActive || isSelected}
                                />
                            </Wrapper>

                            {isActive && <Text style={styles.activeText}>ACTIVE PLAN</Text>}
                            {isBusyThisPlan && (
                                <View style={styles.spinnerRow}>
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    onPress={onRestore}
                    disabled={isBusyAny}
                    style={{ opacity: isBusyAny ? 0.5 : 1 }}
                >
                    <Text style={styles.restore}>
                        {loadingProductId === "__restore__" ? "Restoring…" : "Restore Purchases"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.legal}>
                    Subscriptions auto-renew unless cancelled at least 24 hours before the end of
                    the current period. Manage or cancel in App Store › Account › Subscriptions.
                    Payment is charged to your Apple ID at confirmation of purchase.
                </Text>
            </ScrollView>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 24, backgroundColor: "#020617" },
    header: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 6 },
    subHeader: { color: "#94a3b8", fontSize: 14, marginBottom: 20 },
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
    activeText: {
        marginTop: 8,
        color: "#22c55e",
        fontWeight: "900",
        textAlign: "center",
    },
    spinnerRow: { marginTop: 10, alignItems: "center" },
    restore: {
        marginTop: 24,
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
        paddingBottom: 40,
    },
});
