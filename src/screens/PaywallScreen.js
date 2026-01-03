import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Animated,
} from "react-native";
import Constants from "expo-constants";
import { mockSubscribe, verifyIosReceipt, getEntitlement } from "../api/billing";

const isExpoGo = Constants.appOwnership === "expo";

const PLANS = [
    {
        id: "basic",
        productId: "com.bholeshankar.paperai.basic_monthly",
        title: "Basic",
        price: "$8.99 / month",
        credits: 50,
    },
    {
        id: "pro",
        productId: "com.bholeshankar.paperai.pro_monthly",
        title: "Pro",
        price: "$29.99 / month",
        credits: 200,
        popular: true,
        badge: "Most Popular",
    },
    {
        id: "advanced",
        productId: "com.bholeshankar.paperai.advanced_monthly",
        title: "Advanced",
        price: "$279.99 / month",
        credits: 2600,
        badge: "Best Value",
    },
];

export default function PaywallScreen({ navigation }) {
    // IMPORTANT: store loading as productId or null
    const [loadingProductId, setLoadingProductId] = useState(null);
    const [entitlement, setEntitlement] = useState(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    async function loadEntitlement() {
        try {
            const e = await getEntitlement();
            setEntitlement(e);
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        loadEntitlement();
    }, []);

    // animation (kept intact)
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.05,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [scaleAnim]);

    async function subscribe(plan) {
        if (loadingProductId) return; // prevent multiple taps

        try {
            setLoadingProductId(plan.productId);

            // EXPO GO → MOCK
            if (isExpoGo) {
                await mockSubscribe(plan.productId);
                await loadEntitlement();
                Alert.alert("Subscribed", `${plan.title} activated`);
                navigation.goBack();
                return;
            }

            // REAL APPLE IAP (Dev Client / TestFlight)
            const RNIap = require("react-native-iap");
            await RNIap.initConnection();

            // requestSubscription should receive SKU string
            const purchase = await RNIap.requestSubscription(plan.productId);

            if (!purchase?.transactionReceipt) {
                throw new Error("No receipt returned");
            }

            await verifyIosReceipt(purchase.transactionReceipt);

            // finish transaction expects the purchase object
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

            // For now: entitlement-based restore (works for mock)
            // For real IAP later, you can add getAvailablePurchases + verify.
            await loadEntitlement();

            if (entitlement?.active) {
                Alert.alert("Restored", "Subscription restored");
                navigation.goBack();
            } else {
                Alert.alert("No active subscription");
            }
        } catch {
            Alert.alert("Restore failed");
        } finally {
            setLoadingProductId(null);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Upgrade to PaperAI</Text>

            {PLANS.map((plan) => {
                const isActive = !!entitlement?.active && entitlement.productId === plan.productId;

                const Card = plan.popular ? Animated.View : View;

                const isBusyThisPlan = loadingProductId === plan.productId;
                const isBusyAny = !!loadingProductId;

                return (
                    <TouchableOpacity
                        key={plan.productId}
                        activeOpacity={0.85}
                        // ✅ disabled must be boolean only
                        disabled={isActive || isBusyAny}
                        onPress={() => subscribe(plan)}
                    >
                        <Card
                            style={[
                                styles.card,
                                plan.popular && styles.popularCard,
                                plan.popular && { transform: [{ scale: scaleAnim }] },
                                isActive && styles.activeCard,
                            ]}
                        >
                            {plan.badge && <Text style={styles.badge}>{plan.badge}</Text>}
                            {isActive && <Text style={styles.activeText}>ACTIVE PLAN</Text>}

                            <Text style={styles.title}>{plan.title}</Text>
                            <Text style={styles.price}>{plan.price}</Text>
                            <Text style={styles.credits}>{plan.credits} credits / month</Text>

                            {isBusyThisPlan && <ActivityIndicator color="#fff" />}
                        </Card>
                    </TouchableOpacity>
                );
            })}

            <TouchableOpacity onPress={restore} disabled={!!loadingProductId}>
                <Text style={styles.restore}>
                    {loadingProductId === "__restore__" ? "Restoring…" : "Restore Purchases"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: "#020617" },
    header: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 20 },
    card: {
        backgroundColor: "#0f172a",
        borderRadius: 18,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#1e293b",
    },
    popularCard: {
        borderColor: "#6366f1",
        backgroundColor: "#1e1b4b",
    },
    activeCard: {
        borderColor: "#22c55e",
    },
    badge: {
        color: "#facc15",
        fontWeight: "800",
        marginBottom: 6,
    },
    activeText: {
        color: "#22c55e",
        fontWeight: "900",
        marginBottom: 6,
    },
    title: { color: "#fff", fontSize: 18, fontWeight: "800" },
    price: { color: "#e0e7ff", marginTop: 4 },
    credits: { color: "#a5b4fc", marginTop: 4 },
    restore: {
        marginTop: 20,
        color: "#94a3b8",
        textAlign: "center",
        textDecorationLine: "underline",
    },
});
