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
import { mockSubscribe, verifyIosReceipt, getEntitlement } from "../api/billing";
import SubscriptionPlanCard from "../ui/SubscriptionPlanCard";
import ScreenContainer from "../ui/ScreenContainer";

const isExpoGo = Constants.appOwnership === "expo";

/**
 * IMPORTANT:
 * - Keep productId exactly as your system expects.
 * - You can change title/price/badges safely (UI-only).
 *
 * If your real App Store Connect productIds for weekly/monthly/yearly differ,
 * update ONLY productId strings later (no other logic changes needed).
 */
const PLANS = [
    {
        id: "weekly",
        productId: "com.bholeshankar.paperai.pro_weekly", // keep your existing ID for now if that’s what backend expects
        title: "Weekly",
        price: "$8.99 / week",
    },
    {
        id: "monthly",
        productId: "com.bholeshankar.paperai.pro_monthly", // keep existing
        title: "Monthly",
        price: "$29.90 / month",
        badge: "16.6% OFF",
    },
    {
        id: "yearly",
        productId: "com.bholeshankar.paperai.pro_yearly", // keep existing
        title: "Yearly",
        price: "$279 / year",
        badge: "40% OFF · Best Value",
        highlight: true,
    },
];

export default function PaywallScreen({ navigation }) {
    const [loadingProductId, setLoadingProductId] = useState(null);
    const [entitlement, setEntitlement] = useState(null);

    // purely UI selection (does NOT affect entitlement logic)
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


    useEffect(() => {
        loadEntitlement();
    }, []);

    // subtle animation for highlight card only
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.04,
                    duration: 900,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [scaleAnim]);

    async function subscribe(plan) {
        if (loadingProductId) return;

        try {
            setLoadingProductId(plan.productId);

            // EXPO GO → MOCK (unchanged)
            if (isExpoGo) {
                await mockSubscribe(plan.productId);
                await loadEntitlement();
                Alert.alert("Subscribed", `${plan.title} activated`);
                navigation.goBack();
                return;
            }

            // REAL APPLE IAP (unchanged)
            const RNIap = require("react-native-iap");
            await RNIap.initConnection();

            const purchase = await RNIap.requestSubscription(plan.productId);

            if (!purchase?.transactionReceipt) {
                throw new Error("No receipt returned");
            }

            await verifyIosReceipt(purchase.transactionReceipt);
            await RNIap.finishTransaction(purchase);

            await loadEntitlement();
            Alert.alert("Subscribed", `${plan.title} activated`);
            navigation.goBack();
        } catch (e) {
            Alert.alert("Subscription failed", e?.message || "Try again");
        } finally {
            setLoadingProductId(null);
        }
    }

    async function restore() {
        if (loadingProductId) return;

        try {
            setLoadingProductId("__restore__");

            // entitlement-based restore (works for mock)
            await loadEntitlement();

            const hasActive = !!entitlement?.active;

            if (hasActive) {
                Alert.alert("Restored", "Subscription restored", [
                    {
                        text: "OK",
                        onPress: () => {
                            // wait for alert close animation → smooth pop
                            setTimeout(() => navigation.goBack(), 250);
                        },
                    },
                ]);
            } else {
                Alert.alert("No active subscription", "We couldn't find an active plan.", [
                    {
                        text: "OK",
                        onPress: () => {
                            // smooth return to paywall state
                            setTimeout(() => setLoadingProductId(null), 150);
                        },
                    },
                ]);
                return; // prevent finally from instantly removing skeleton
            }
        } catch {
            Alert.alert("Restore failed", "Please try again.", [
                {
                    text: "OK",
                    onPress: () => setTimeout(() => setLoadingProductId(null), 150),
                },
            ]);
            return;
        } finally {
            // If user has active subscription, we navigate away on OK.
            // If not active / failed, we already unset loading in alert handler.
            // So only clear here if still restoring (safety).
            setTimeout(() => {
                setLoadingProductId((prev) => (prev === "__restore__" ? null : prev));
            }, 200);
        }
    }


    const isBusyAny = !!loadingProductId;

    return (

        <ScreenContainer>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <Text style={styles.header}>Upgrade to AI Pro</Text>
            <Text style={styles.subHeader}>Pick a plan. You can cancel anytime.</Text>

            {PLANS.map((plan) => {
                const isActive =
                    !!entitlement?.active && entitlement.productId === plan.productId;

                const isBusyThisPlan = loadingProductId === plan.productId;

                const isSelected = selectedPlanId === plan.id;

                const Wrapper = plan.highlight ? Animated.View : View;
                const wrapperStyle = plan.highlight ? { transform: [{ scale: scaleAnim }] } : null;

                return (
                    <TouchableOpacity
                        key={plan.productId}
                        activeOpacity={0.9}
                        disabled={isActive || isBusyAny}
                        onPress={() => {
                            // UI selection (safe)
                            setSelectedPlanId(plan.id);
                            // preserve your original behavior: tap card subscribes
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
                                // show selected UI state (or ACTIVE plan state)
                                selected={isActive || isSelected}
                                onPress={() => {
                                    setSelectedPlanId(plan.id);
                                    subscribe(plan);
                                }}
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

            <TouchableOpacity onPress={restore} disabled={!!loadingProductId}>
                <Text style={styles.restore}>
                    {loadingProductId === "__restore__" ? "Restoring…" : "Restore Purchases"}
                </Text>
            </TouchableOpacity>
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

    spinnerRow: {
        marginTop: 10,
        alignItems: "center",
    },

    restore: {
        marginTop: 24,
        color: "#94a3b8",
        textAlign: "center",
        textDecorationLine: "underline",
    },
});
