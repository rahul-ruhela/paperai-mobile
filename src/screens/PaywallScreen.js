/**
 * PaywallScreen — Production-ready Apple IAP subscription flow.
 *
 * Flow:
 *  1. On mount: initConnection + purchaseUpdatedListener + purchaseErrorListener
 *  2. User taps plan → requestSubscription({ sku })
 *  3. Apple shows payment sheet; user approves → purchaseUpdatedListener fires
 *  4. Listener verifies with backend (verify-transaction-auto) → finishTransaction → refresh entitlement
 *  5. Restore: getAvailablePurchases → verify most recent → refresh entitlement
 *  6. Expo Go / no IAP: falls back to mockSubscribe (blocked by backend in production)
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
    Platform,
} from "react-native";
import Constants from "expo-constants";
import {
    initConnection,
    purchaseUpdatedListener,
    purchaseErrorListener,
    requestSubscription,
    getAvailablePurchases,
    finishTransaction,
    endConnection,
} from "react-native-iap";

import { mockSubscribe, verifyIosTransactionAuto, getEntitlement } from "../api/billing";
import { IAP_SKUS, API } from "../constants/api";
import SubscriptionPlanCard from "../ui/SubscriptionPlanCard";
import ScreenContainer from "../ui/ScreenContainer";

// ─── Environment detection ────────────────────────────────────────────────
// isExpoGo: running inside Expo Go app — IAP native module is unavailable
const isExpoGo = Constants.executionEnvironment === "storeClient";
const iapSupported = !isExpoGo && Platform.OS === "ios";

// ─── Plans ────────────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────
export default function PaywallScreen({ navigation }) {
    const [loadingProductId, setLoadingProductId] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const [selectedPlanId, setSelectedPlanId] = useState("yearly");

    const purchaseUpdateSub = useRef(null);
    const purchaseErrorSub = useRef(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // ── Entitlement ───────────────────────────────────────────────────────
    async function loadEntitlement() {
        try {
            const e = await getEntitlement();
            setEntitlement(e);
            return e;
        } catch {
            return null;
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────
    useEffect(() => {
        loadEntitlement();

        // Highlight animation for the best-value card
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();

        if (iapSupported) _setupIap();

        return () => {
            loop.stop();
            purchaseUpdateSub.current?.remove();
            purchaseErrorSub.current?.remove();
            if (iapSupported) endConnection().catch(() => {});
        };
    }, []);

    async function _setupIap() {
        try {
            await initConnection();

            // Fires when Apple confirms a purchase (including unfinished from a previous session)
            purchaseUpdateSub.current = purchaseUpdatedListener(async (purchase) => {
                const transactionId = purchase?.transactionId;
                if (!transactionId) return;

                try {
                    // Backend auto-detects sandbox vs production — works on TestFlight + App Store
                    await verifyIosTransactionAuto(transactionId);

                    // Acknowledge to Apple — prevents refund / re-delivery
                    await finishTransaction({ purchase, isConsumable: false });

                    await loadEntitlement();

                    const planTitle =
                        PLANS.find((p) => p.productId === purchase.productId)?.title ?? "Pro";

                    Alert.alert(
                        "Subscribed!",
                        `${planTitle} plan is now active. Thank you!`,
                        [{ text: "Continue", onPress: () => navigation.goBack() }]
                    );
                } catch {
                    // Payment received by Apple, but backend verification failed.
                    // Do NOT call finishTransaction here — let Apple re-deliver on next launch.
                    Alert.alert(
                        "Verification issue",
                        "Your payment was received but we couldn't confirm it right now. " +
                            "Please contact support — we'll activate your account immediately.",
                        [{ text: "OK" }]
                    );
                } finally {
                    setLoadingProductId(null);
                }
            });

            // Fires on purchase error or user cancel
            purchaseErrorSub.current = purchaseErrorListener((error) => {
                setLoadingProductId(null);

                if (error?.code === "E_USER_CANCELLED") return; // silent cancel

                if (error?.code === "E_ALREADY_OWNED") {
                    // User already has this subscription — restore it
                    loadEntitlement().then((e) => {
                        if (e?.active) {
                            Alert.alert(
                                "Already subscribed",
                                "You already have an active subscription.",
                                [{ text: "OK", onPress: () => navigation.goBack() }]
                            );
                        }
                    });
                    return;
                }

                Alert.alert(
                    "Purchase failed",
                    "We couldn't complete your purchase. Please try again.",
                    [{ text: "OK" }]
                );
            });
        } catch {
            // IAP unavailable on this device — app still renders, buttons disabled gracefully
        }
    }

    // ── Subscribe ─────────────────────────────────────────────────────────
    async function subscribe(plan) {
        if (loadingProductId) return;
        setLoadingProductId(plan.productId);

        // Dev / Expo Go: use mock subscribe (backend blocks this in production)
        if (!iapSupported) {
            try {
                await mockSubscribe(plan.productId);
                await loadEntitlement();
                Alert.alert("Subscribed (dev)", `${plan.title} activated.`);
                navigation.goBack();
            } catch (e) {
                Alert.alert("Error", e?.userMessage ?? "Could not activate subscription.");
            } finally {
                setLoadingProductId(null);
            }
            return;
        }

        // Real Apple IAP — requestSubscription returns void on iOS;
        // the actual purchase arrives via purchaseUpdatedListener above.
        try {
            await requestSubscription({ sku: plan.productId });
        } catch (e) {
            if (e?.code !== "E_USER_CANCELLED") {
                Alert.alert(
                    "Purchase unavailable",
                    "We couldn't start the purchase. Please check your App Store account and try again.",
                    [{ text: "OK" }]
                );
            }
            setLoadingProductId(null);
        }
    }

    // ── Restore purchases ─────────────────────────────────────────────────
    async function restore() {
        if (loadingProductId) return;
        setLoadingProductId("__restore__");

        try {
            if (!iapSupported) {
                const e = await loadEntitlement();
                if (e?.active) {
                    Alert.alert("Restored", "Your subscription is active.", [
                        { text: "OK", onPress: () => navigation.goBack() },
                    ]);
                } else {
                    Alert.alert("Nothing to restore", "No active subscription found.");
                }
                return;
            }

            const purchases = await getAvailablePurchases();

            const subPurchases = purchases
                .filter((p) => PLANS.some((plan) => plan.productId === p.productId))
                .sort((a, b) => (b.transactionDate ?? 0) - (a.transactionDate ?? 0));

            if (subPurchases.length === 0) {
                Alert.alert(
                    "Nothing to restore",
                    "No previous subscription found on this Apple ID."
                );
                return;
            }

            const latest = subPurchases[0];
            if (latest?.transactionId) {
                await verifyIosTransactionAuto(latest.transactionId);
                await finishTransaction({ purchase: latest, isConsumable: false }).catch(() => {});
            }

            const e = await loadEntitlement();
            if (e?.active) {
                Alert.alert("Restored!", "Your subscription has been restored.", [
                    { text: "Continue", onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert(
                    "Subscription expired",
                    "Your previous subscription has expired. Please subscribe to continue."
                );
            }
        } catch (e) {
            Alert.alert(
                "Restore failed",
                e?.userMessage ?? "We couldn't restore your purchase. Please try again.",
                [{ text: "OK" }]
            );
        } finally {
            setLoadingProductId(null);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────
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

                {PLANS.map((plan) => {
                    const isActive =
                        !!entitlement?.active && entitlement.productId === plan.productId;
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
                            onPress={() => {
                                setSelectedPlanId(plan.id);
                                subscribe(plan);
                            }}
                            style={{ marginBottom: 16 }}
                        >
                            <Wrapper style={wrapperStyle}>
                                <SubscriptionPlanCard
                                    title={plan.title}
                                    price={plan.price}
                                    badge={plan.badge}
                                    highlight={plan.highlight}
                                    selected={isActive || isSelected}
                                />
                            </Wrapper>

                            {isActive && (
                                <Text style={styles.activeText}>ACTIVE PLAN</Text>
                            )}
                            {isBusyThisPlan && (
                                <View style={styles.spinnerRow}>
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    onPress={restore}
                    disabled={isBusyAny}
                    style={{ opacity: isBusyAny ? 0.5 : 1 }}
                >
                    <Text style={styles.restore}>
                        {loadingProductId === "__restore__" ? "Restoring…" : "Restore Purchases"}
                    </Text>
                </TouchableOpacity>

                {/* Apple-required legal text for subscription apps */}
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
