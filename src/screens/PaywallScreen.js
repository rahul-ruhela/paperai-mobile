import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
} from "react-native";
import * as RNIap from "react-native-iap";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";

/**
 * DO NOT CHANGE
 * These product IDs already exist in App Store Connect
 */
const PRODUCT_IDS = [
    "com.bholeshankar.paperai.pro_weekly",
    "com.bholeshankar.paperai.pro_monthly",
    "com.bholeshankar.paperai.pro_yearly",
];

// Optional: set this to your API base URL
const API_BASE_URL = "http://192.168.29.223:5263"; // e.g. https://api.yourdomain.com

export default function PaywallScreen() {
    const navigation = useNavigation();

    const [subscriptions, setSubscriptions] = useState([]);
    const [loadingSku, setLoadingSku] = useState(null);
    const [initState, setInitState] = useState({
        started: false,
        disabledReason: null,
        lastError: null,
    });

    const purchaseUpdateSub = useRef(null);
    const purchaseErrorSub = useRef(null);

    // Expo Go: Constants.appOwnership === "expo"
    const isExpoGo = Constants.appOwnership === "expo";

    /**
     * Dev Client detection:
     * In Expo Dev Client you are still in a dev runtime (__DEV__ true),
     * but NOT Expo Go.
     *
     * This is the most reliable practical signal:
     * - Dev Client / local dev => __DEV__ true
     * - TestFlight / App Store => __DEV__ false
     */
    const isDevClientLike = __DEV__ && !isExpoGo;

    const envLabel = isExpoGo ? "EXPO_GO" : isDevClientLike ? "DEV_CLIENT" : "TESTFLIGHT_OR_PROD";

    const log = (...args) => console.log(`[PAYWALL][${envLabel}]`, ...args);

    useEffect(() => {
        // Two-mode behavior:
        // - Expo Go: disable
        // - Dev Client: disable (IAP cannot complete; avoid crashes/confusion)
        // - TestFlight/Prod: enable real IAP
        if (isExpoGo) {
            setInitState({
                started: false,
                disabledReason: "In-App Purchases do not work in Expo Go.",
                lastError: null,
            });
            log("IAP disabled: Expo Go");
            return;
        }

        if (isDevClientLike) {
            setInitState({
                started: false,
                disabledReason:
                    "In-App Purchases cannot be completed in Expo Dev Client. Install a TestFlight build to test real payments.",
                lastError: null,
            });
            log("IAP disabled: Dev Client (use TestFlight for real IAP)");
            return;
        }

        // Real IAP mode (TestFlight / Production)
        initIap();

        return () => cleanup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initIap = async () => {
        try {
            setInitState((s) => ({ ...s, started: true, lastError: null }));

            log("initConnection...");
            await RNIap.initConnection();

            if (Platform.OS === "ios") {
                // Clears pending transactions that can block purchases
                log("clearTransactionIOS...");
                await RNIap.clearTransactionIOS();
            }

            // ✅ Correct v12+ signature (fixes "skus is required")
            log("getSubscriptions ->", PRODUCT_IDS);
            const subs = await RNIap.getSubscriptions({ skus: PRODUCT_IDS });
            log("getSubscriptions returned:", subs?.length ?? 0);

            setSubscriptions(Array.isArray(subs) ? subs : []);

            // Purchase updated
            purchaseUpdateSub.current = RNIap.purchaseUpdatedListener(async (purchase) => {
                try {
                    // ✅ Hard guards (prevents "transactionId of undefined")
                    if (!purchase) {
                        log("purchaseUpdatedListener: purchase is undefined");
                        return;
                    }

                    const {
                        transactionReceipt,
                        transactionId,
                        productId,
                        originalTransactionIdentifierIOS,
                    } = purchase;

                    log("purchaseUpdatedListener:", {
                        productId,
                        transactionId,
                        hasReceipt: !!transactionReceipt,
                        originalTransactionIdentifierIOS,
                    });

                    // If no receipt, cannot verify or finish reliably
                    if (!transactionReceipt) {
                        log("No transactionReceipt yet; ignoring this event.");
                        return;
                    }

                    // Verify on backend (REAL)
                    await verifyIosReceiptOnBackend({
                        receipt: transactionReceipt,
                        productId: productId || null,
                        transactionId: transactionId || null,
                        originalTransactionId: originalTransactionIdentifierIOS || null,
                    });

                    // Finish transaction (must be done or Apple may keep it pending)
                    await RNIap.finishTransaction(purchase, false);

                    Alert.alert("Success", "Subscription activated.");
                    navigation.goBack();
                } catch (err) {
                    const msg = err?.message || "Verification failed.";
                    log("Purchase flow error:", msg, err);

                    Alert.alert("Purchase Error", msg);

                    // Attempt to finish transaction anyway if possible (avoid stuck queue)
                    try {
                        if (purchase) await RNIap.finishTransaction(purchase, false);
                    } catch (finishErr) {
                        log("finishTransaction after error failed:", finishErr?.message || finishErr);
                    }
                } finally {
                    setLoadingSku(null);
                }
            });

            // Purchase error
            purchaseErrorSub.current = RNIap.purchaseErrorListener((err) => {
                const code = err?.code;
                const message = err?.message || "Purchase failed.";
                log("purchaseErrorListener:", { code, message, err });

                // ✅ Correct cancel handling (don’t show as failure)
                if (code === "E_USER_CANCELLED") {
                    log("User cancelled purchase (no alert).");
                    setLoadingSku(null);
                    return;
                }

                Alert.alert("Purchase Failed", message);
                setLoadingSku(null);
            });
        } catch (err) {
            const msg = err?.message || String(err);
            log("IAP init error:", msg, err);
            setInitState((s) => ({ ...s, lastError: msg }));
        }
    };

    const subscribe = async (productId) => {
        try {
            if (initState.disabledReason) {
                Alert.alert("IAP Disabled", initState.disabledReason);
                return;
            }

            setLoadingSku(productId);
            log("requestSubscription:", productId);

            // ✅ Correct v12+ signature (fixes "'in' is not an object")
            await RNIap.requestSubscription({ sku: productId });
        } catch (err) {
            const code = err?.code;
            const message = err?.message || "Unable to start purchase.";
            log("subscribe error:", { code, message, err });

            // Same cancel handling here too (some devices throw here instead of listener)
            if (code === "E_USER_CANCELLED") {
                setLoadingSku(null);
                return;
            }

            Alert.alert("Subscription Failed", message);
            setLoadingSku(null);
        }
    };

    const restorePurchases = async () => {
        try {
            if (initState.disabledReason) {
                Alert.alert("IAP Disabled", initState.disabledReason);
                return;
            }

            log("restorePurchases: getAvailablePurchases...");
            const purchases = await RNIap.getAvailablePurchases();
            log("available purchases:", purchases?.length ?? 0);

            if (!purchases || purchases.length === 0) {
                Alert.alert("Restore Purchases", "No active purchases found.");
                return;
            }

            // Usually you’d send latest receipt(s) to backend.
            // iOS receipts are bundled; you can verify per purchase receipt if available.
            Alert.alert("Restore Purchases", "Purchases restored.");
            navigation.goBack();
        } catch (err) {
            const msg = err?.message || "Restore failed.";
            log("restorePurchases error:", msg, err);
            Alert.alert("Restore Failed", msg);
        }
    };

    const cleanup = () => {
        log("cleanup...");
        purchaseUpdateSub.current?.remove();
        purchaseErrorSub.current?.remove();
        RNIap.endConnection();
    };

    /**
     * REAL verification: call your .NET backend.
     * Backend validates with Apple and returns entitlement info.
     */
    const verifyIosReceiptOnBackend = async ({
        receipt,
        productId,
        transactionId,
        originalTransactionId,
    }) => {
        // IMPORTANT: make sure API_BASE_URL is set
        const url = `${API_BASE_URL}/api/iap/ios/verify`;

        log("verifyIosReceiptOnBackend ->", {
            productId,
            transactionId,
            originalTransactionId,
            receiptLen: receipt?.length ?? 0,
        });

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                receiptData: receipt,
                productId,
                transactionId,
                originalTransactionId,
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Receipt verify failed (${res.status}): ${text || "No details"}`);
        }

        const data = await res.json();

        // Expect backend to return something like: { active: true, expiresAt: "...", productId: "..." }
        if (!data?.active) {
            throw new Error(data?.message || "Subscription not active after verification.");
        }

        return data;
    };

    // ----------------------------
    // UI (two-mode paywall)
    // ----------------------------
    if (initState.disabledReason) {
        return (
            <View style={styles.center}>
                <Text style={styles.warning}>{initState.disabledReason}</Text>
                <Text style={styles.helpText}>
                    Current mode: {envLabel}
                    {"\n"}To test real IAP: build & install via TestFlight.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Upgrade to PaperAI Pro</Text>

            {!!initState.lastError && (
                <Text style={styles.errorText}>IAP Error: {initState.lastError}</Text>
            )}

            {subscriptions.length === 0 ? (
                <Text style={styles.emptyText}>
                    No plans loaded from App Store Connect yet.
                    {"\n"}Make sure you’re running a TestFlight build and your subscriptions are “Ready to Submit”.
                </Text>
            ) : (
                subscriptions.map((sub) => (
                    <TouchableOpacity
                        key={sub.productId}
                        style={styles.card}
                        onPress={() => subscribe(sub.productId)}
                        disabled={loadingSku === sub.productId}
                    >
                        <Text style={styles.plan}>{sub.title}</Text>
                        <Text style={styles.price}>{sub.localizedPrice}</Text>

                        {loadingSku === sub.productId && (
                            <ActivityIndicator style={{ marginTop: 10 }} />
                        )}
                    </TouchableOpacity>
                ))
            )}

            <TouchableOpacity onPress={restorePurchases} style={{ marginTop: 12 }}>
                <Text style={styles.restore}>Restore Purchases</Text>
            </TouchableOpacity>
        </View>
    );
}

// ----------------------------
// STYLES
// ----------------------------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: "#0B0B0B",
    },
    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 24,
        textAlign: "center",
    },
    card: {
        backgroundColor: "#1C1C1E",
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
    },
    plan: {
        fontSize: 18,
        color: "#fff",
        fontWeight: "600",
    },
    price: {
        fontSize: 16,
        color: "#aaa",
        marginTop: 6,
    },
    restore: {
        color: "#4da3ff",
        textAlign: "center",
        fontSize: 15,
    },
    center: {
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#0B0B0B",
    },
    warning: {
        color: "#ffcc00",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 10,
    },
    helpText: {
        color: "#aaa",
        fontSize: 13,
        textAlign: "center",
        lineHeight: 18,
    },
    emptyText: {
        color: "#aaa",
        textAlign: "center",
        marginTop: 40,
        lineHeight: 20,
    },
    errorText: {
        color: "#ff6b6b",
        textAlign: "center",
        marginBottom: 12,
    },
});
