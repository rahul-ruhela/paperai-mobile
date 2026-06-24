/**
 * PaywallScreen — subscription flow via backend mock.
 * Native IAP (react-native-iap) is temporarily removed to unblock the iOS build.
 * Re-add once a new-arch-compatible IAP package is available for RN 0.81.
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

import { mockSubscribe, getEntitlement } from "../api/billing";
import { IAP_SKUS } from "../constants/api";
import SubscriptionPlanCard from "../ui/SubscriptionPlanCard";
import ScreenContainer from "../ui/ScreenContainer";

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

export default function PaywallScreen({ navigation }) {
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

    async function subscribe(plan) {
        if (loadingProductId) return;
        setLoadingProductId(plan.productId);

        try {
            await mockSubscribe(plan.productId);
            await loadEntitlement();
            Alert.alert("Subscribed!", `${plan.title} plan is now active. Thank you!`, [
                { text: "Continue", onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            Alert.alert("Error", e?.userMessage ?? "Could not activate subscription. Please try again.");
        } finally {
            setLoadingProductId(null);
        }
    }

    async function restore() {
        if (loadingProductId) return;
        setLoadingProductId("__restore__");

        try {
            const e = await loadEntitlement();
            if (e?.active) {
                Alert.alert("Restored", "Your subscription is active.", [
                    { text: "OK", onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert("Nothing to restore", "No active subscription found.");
            }
        } catch (e) {
            Alert.alert("Restore failed", e?.userMessage ?? "Please try again.");
        } finally {
            setLoadingProductId(null);
        }
    }

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
