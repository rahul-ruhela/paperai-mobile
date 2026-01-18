import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Pressable,
    Linking,
} from "react-native";
import * as RNIap from "react-native-iap";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import * as SecureStore from "expo-secure-store";

import {
    verifyIosReceipt,
    syncIosReceipt,
    getEntitlement,
    verifyIosTransaction,
} from "../api/billing";

const PRODUCT_IDS = [
    "com.bholeshankar.paperai.pro_weekly",
    "com.bholeshankar.paperai.pro_monthly",
    "com.bholeshankar.paperai.pro_yearly",
];

function normalizeTransactionId(purchase) {
    return (
        purchase?.transactionId ||
        purchase?.transaction_id ||
        purchase?.originalTransactionIdentifierIOS ||
        purchase?.original_transaction_id ||
        null
    );
}

function planLabel(productId) {
    if (!productId) return "Unknown plan";
    if (productId.includes("weekly")) return "Pro Weekly";
    if (productId.includes("monthly")) return "Pro Monthly";
    if (productId.includes("yearly")) return "Pro Yearly";
    return productId;
}

export default function PaywallScreen() {
    const navigation = useNavigation();

    const [subscriptions, setSubscriptions] = useState([]);
    const [loadingSku, setLoadingSku] = useState(null);
    const [checkingEntitlement, setCheckingEntitlement] = useState(false);
    const [entitlement, setEntitlement] = useState(null);

    const purchaseUpdateSub = useRef(null);
    const purchaseErrorSub = useRef(null);

    const isExpoGo = Constants.appOwnership === "expo";

    useEffect(() => {
        if (isExpoGo) {
            console.warn("IAP is not supported in Expo Go");
            return;
        }

        initIap();

        return () => cleanup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initIap = async () => {
        try {
            await RNIap.initConnection();

            // NOTE: avoid clearing transactions in production.
            // keep it for dev/testing only.
            if (Platform.OS === "ios" && __DEV__) {
                await RNIap.clearTransactionIOS();
            }

            const subs = await RNIap.getSubscriptions({ skus: PRODUCT_IDS });
            setSubscriptions(Array.isArray(subs) ? subs : []);

            purchaseUpdateSub.current = RNIap.purchaseUpdatedListener(
                async (purchase) => {
                    try {
                        if (!purchase) {
                            Alert.alert(
                                "Purchase Not Completed",
                                "We couldn't confirm your purchase. Please try again."
                            );
                            return;
                        }

                        const receipt = purchase?.transactionReceipt;
                        const txId = normalizeTransactionId(purchase);

                        // ✅ StoreKit 2 fallback:
                        // If receipt is missing but txId exists, verify via transactionId
                        if (!receipt && !txId) {
                            Alert.alert(
                                "Purchase Not Completed",
                                "We couldn't read purchase details from Apple. Please try again or tap Restore Purchases."
                            );
                            return;
                        }

                        // Cache receipt if available (helps restore/sync)
                        if (receipt) {
                            await SecureStore.setItemAsync("lastIosReceipt", receipt);
                        }

                        // ✅ Verify with backend:
                        // - prefer receipt verification if available
                        // - else verify by transactionId (StoreKit2)
                        if (receipt) {
                            await verifyIosReceipt(receipt);
                        } else {
                            await verifyIosTransaction(txId);
                        }

                        // ✅ Finish transaction after verification
                        await RNIap.finishTransaction(purchase, false);

                        Alert.alert(
                            "Subscription Confirmed",
                            "Your subscription has been verified successfully. Credits will appear shortly."
                        );

                        // Refresh entitlement view
                        await refreshEntitlement();
                    } catch (err) {
                        const msg =
                            err?.response?.data?.message ||
                            err?.response?.data?.error ||
                            err?.message ||
                            "We couldn't verify your purchase. Please try again.";
                        Alert.alert("Verification Failed", msg);
                    } finally {
                        setLoadingSku(null);
                    }
                }
            );

            purchaseErrorSub.current = RNIap.purchaseErrorListener((err) => {
                const message =
                    err?.code === "E_USER_CANCELLED"
                        ? "Purchase cancelled. No charges were made."
                        : err?.message || "Unable to complete purchase. Please try again.";

                Alert.alert("Purchase", message);
                setLoadingSku(null);
            });

            await refreshEntitlement();
        } catch (err) {
            console.error("IAP init error:", err);
            Alert.alert(
                "Store Unavailable",
                "We couldn't connect to the App Store right now. Please try again in a moment."
            );
        }
    };

    const refreshEntitlement = async () => {
        try {
            setCheckingEntitlement(true);
            const ent = await getEntitlement();
            setEntitlement(ent || null);
        } catch {
            // ignore
        } finally {
            setCheckingEntitlement(false);
        }
    };

    const subscribe = async (productId) => {
        try {
            setLoadingSku(productId);

            // ✅ Allow upgrade/downgrade:
            // Do NOT block if already subscribed — Apple will handle changes within same subscription group.
            await RNIap.requestSubscription({ sku: productId });
        } catch (err) {
            Alert.alert(
                "Subscription Failed",
                err?.message || "Unable to start purchase. Please try again."
            );
            setLoadingSku(null);
        }
    };

    const restorePurchases = async () => {
        try {
            setCheckingEntitlement(true);

            const purchases = await RNIap.getAvailablePurchases();

            const receiptFromApple =
                purchases?.find((p) => p?.transactionReceipt)?.transactionReceipt ||
                null;

            const cached = await SecureStore.getItemAsync("lastIosReceipt");
            const receipt = receiptFromApple || cached;

            // ✅ Restore via receipt if we have it (best)
            if (receipt) {
                await syncIosReceipt(receipt);
            } else {
                // If no receipt, try verifying at least one transactionId
                const tx = purchases?.find((p) => normalizeTransactionId(p));
                const txId = tx ? normalizeTransactionId(tx) : null;
                if (txId) {
                    await verifyIosTransaction(txId);
                }
            }

            await refreshEntitlement();

            Alert.alert(
                "Restored",
                "Your purchases have been restored successfully."
            );
        } catch (err) {
            Alert.alert(
                "Restore Failed",
                err?.message || "Unable to restore purchases. Please try again."
            );
        } finally {
            setCheckingEntitlement(false);
        }
    };

    const openManageSubscriptions = async () => {
        // Apple subscription management
        const url = "https://apps.apple.com/account/subscriptions";
        Linking.openURL(url);
    };

    const cleanup = () => {
        try {
            purchaseUpdateSub.current?.remove?.();
            purchaseErrorSub.current?.remove?.();
            RNIap.endConnection();
        } catch {
            // ignore
        }
    };

    const currentPlan = entitlement?.active ? entitlement?.productId : null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Upgrade Your Plan</Text>

            <Text style={styles.subtitle}>
                Subscribe to unlock more credits and faster processing.
            </Text>

            {checkingEntitlement ? (
                <View style={styles.rowCenter}>
                    <ActivityIndicator />
                    <Text style={styles.smallNote}>Checking subscription…</Text>
                </View>
            ) : entitlement?.active ? (
                <View style={styles.currentBox}>
                    <Text style={styles.currentTitle}>Current Subscription</Text>
                    <Text style={styles.currentValue}>{planLabel(currentPlan)}</Text>
                    <Text style={styles.currentDesc}>
                        You can switch plans anytime. Apple will handle the upgrade or
                        downgrade automatically.
                    </Text>

                    <Pressable onPress={openManageSubscriptions} style={styles.linkBtn}>
                        <Text style={styles.linkText}>Manage Subscription in Apple</Text>
                    </Pressable>
                </View>
            ) : null}

            <View style={{ height: 14 }} />

            {PRODUCT_IDS.map((pid) => {
                const isCurrent = entitlement?.active && currentPlan === pid;

                return (
                    <TouchableOpacity
                        key={pid}
                        style={[styles.card, isCurrent && styles.cardCurrent]}
                        onPress={() => subscribe(pid)}
                        disabled={loadingSku === pid}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{planLabel(pid)}</Text>
                            <Text style={styles.cardMeta}>
                                {pid.includes("weekly")
                                    ? "Weekly plan"
                                    : pid.includes("monthly")
                                        ? "Monthly plan"
                                        : "Yearly plan"}
                            </Text>
                            {isCurrent ? (
                                <Text style={styles.badge}>Current plan</Text>
                            ) : null}
                        </View>

                        {loadingSku === pid ? (
                            <ActivityIndicator />
                        ) : (
                            <Text style={styles.cta}>{isCurrent ? "Selected" : "Continue"}</Text>
                        )}
                    </TouchableOpacity>
                );
            })}

            <View style={{ height: 14 }} />

            <Pressable onPress={restorePurchases} style={styles.restoreBtn}>
                <Text style={styles.restoreText}>Restore Purchases</Text>
            </Pressable>

            <Text style={styles.legal}>
                Payment will be charged to your Apple ID account at confirmation of
                purchase. Subscription automatically renews unless canceled at least 24
                hours before the end of the current period. You can manage or cancel
                subscriptions in your Apple account settings.
            </Text>

            <View style={styles.linksRow}>
                <Pressable onPress={() => navigation.navigate("Terms")}>
                    <Text style={styles.linkText}>Terms of Use</Text>
                </Pressable>
                <Text style={styles.dot}>•</Text>
                <Pressable onPress={() => navigation.navigate("Privacy")}>
                    <Text style={styles.linkText}>Privacy Policy</Text>
                </Pressable>
            </View>

            <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
                <Text style={styles.closeText}>Not now</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, backgroundColor: "#0B1220" },
    title: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 8 },
    subtitle: { color: "#CBD5E1", marginTop: 8, marginBottom: 12 },

    rowCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
    smallNote: { color: "#CBD5E1" },

    currentBox: {
        borderWidth: 1,
        borderColor: "#334155",
        borderRadius: 14,
        padding: 12,
        backgroundColor: "#0F172A",
    },
    currentTitle: { color: "#E2E8F0", fontWeight: "700" },
    currentValue: { color: "#fff", fontSize: 16, marginTop: 4 },
    currentDesc: { color: "#CBD5E1", marginTop: 6, lineHeight: 18 },

    card: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        borderRadius: 14,
        backgroundColor: "#0F172A",
        borderWidth: 1,
        borderColor: "#1F2937",
        marginBottom: 10,

        // shadow warning fix comes later; for now we avoid heavy shadow
    },
    cardCurrent: { borderColor: "#A78BFA" },
    cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
    cardMeta: { color: "#94A3B8", marginTop: 3 },
    badge: { color: "#A78BFA", marginTop: 6, fontWeight: "600" },
    cta: { color: "#E2E8F0", fontWeight: "700" },

    restoreBtn: { paddingVertical: 10 },
    restoreText: { color: "#93C5FD", fontWeight: "700" },

    legal: { color: "#94A3B8", fontSize: 12, marginTop: 10, lineHeight: 16 },
    linksRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 10,
    },
    dot: { color: "#64748B" },
    linkBtn: { marginTop: 10 },
    linkText: { color: "#93C5FD", fontWeight: "700" },

    closeBtn: { marginTop: 18, paddingVertical: 12, alignItems: "center" },
    closeText: { color: "#CBD5E1" },
});
