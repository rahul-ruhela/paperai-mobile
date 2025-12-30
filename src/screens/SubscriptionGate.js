import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { getEntitlement } from "../api/billing";
import AppButton from "../ui/AppButton";

export default function SubscriptionGate({ navigation, children }) {
    const [loading, setLoading] = useState(true);
    const [entitlement, setEntitlement] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const e = await getEntitlement();
                setEntitlement(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <View style={{ marginTop: 24, alignItems: "center" }}>
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 12 }}>Checking subscription…</Text>
            </View>
        );
    }

    if (!entitlement?.isActive) {
        return (
            <View style={{ marginTop: 24, gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "800" }}>
                    Pro required
                </Text>
                <Text style={{ color: "#6B7280" }}>
                    Subscribe to unlock premium processing.
                </Text>
                <AppButton
                    title="View Plans"
                    onPress={() => navigation.navigate("Paywall")}
                />
            </View>
        );
    }

    return children;
}
