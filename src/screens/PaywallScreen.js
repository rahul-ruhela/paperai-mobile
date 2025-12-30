import React, { useEffect, useState } from "react";
import { View, Text, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../ui/AppButton";
import * as RNIap from "react-native-iap";
import { verifyIosReceipt } from "../api/billing";

const PRODUCT_IDS = [
    "paperai_monthly_basic",
    "paperai_monthly_pro",
    "paperai_yearly_pro",
];

export default function PaywallScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                await RNIap.initConnection();
                const subs = await RNIap.getSubscriptions({ skus: PRODUCT_IDS });
                if (mounted) setProducts(subs);
            } catch (e) {
                Alert.alert("IAP error", e.message);
            }
        })();

        return () => {
            mounted = false;
            RNIap.endConnection();
        };
    }, []);

    async function buy(productId) {
        try {
            setBusy(true);

            const purchase = await RNIap.requestSubscription({ sku: productId });

            // IMPORTANT: iOS receipt is obtained via getAvailablePurchases OR getReceiptIOS
            const receipt = await RNIap.getReceiptIOS();
            if (!receipt) throw new Error("No receipt found");

            await verifyIosReceipt(receipt);

            Alert.alert("Success", "Subscription activated");
            navigation.goBack();
        } catch (e) {
            Alert.alert("Purchase failed", e.message);
        } finally {
            setBusy(false);
        }
    }

    async function restore() {
        try {
            setBusy(true);

            const receipt = await RNIap.getReceiptIOS();
            if (!receipt) throw new Error("No receipt found to restore");

            await verifyIosReceipt(receipt);

            Alert.alert("Restored", "Subscription restored");
            navigation.goBack();
        } catch (e) {
            Alert.alert("Restore failed", e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
            <View style={{ flex: 1, padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 26, fontWeight: "800" }}>Go Pro</Text>
                <Text style={{ color: "#6B7280" }}>
                    Unlimited smart workflows, faster processing, and premium templates.
                </Text>

                {products.length === 0 ? (
                    <View style={{ marginTop: 24, alignItems: "center" }}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={{ marginTop: 12, color: "#6B7280" }}>
                            Loading plans…
                        </Text>
                    </View>
                ) : (
                    products.map((p) => (
                        <View
                            key={p.productId}
                            style={{
                                backgroundColor: "#fff",
                                padding: 14,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: "#E5E7EB",
                            }}
                        >
                            <Text style={{ fontWeight: "800", fontSize: 16 }}>
                                {p.title}
                            </Text>
                            <Text style={{ color: "#6B7280", marginTop: 6 }}>
                                {p.description}
                            </Text>
                            <Text style={{ marginTop: 8, fontSize: 18, fontWeight: "900" }}>
                                {p.localizedPrice}
                            </Text>

                            <View style={{ marginTop: 12 }}>
                                <AppButton
                                    title={busy ? "Processing…" : "Subscribe"}
                                    onPress={() => buy(p.productId)}
                                    disabled={busy}
                                />
                            </View>
                        </View>
                    ))
                )}

                <View style={{ marginTop: 10 }}>
                    <Text
                        onPress={restore}
                        style={{ textAlign: "center", color: "#4F46E5", fontWeight: "700" }}
                    >
                        Restore Purchase
                    </Text>
                </View>

                <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center", marginTop: 10 }}>
                    Subscriptions renew automatically unless canceled at least 24 hours before the end of the period.
                </Text>
            </View>
        </SafeAreaView>
    );
}
