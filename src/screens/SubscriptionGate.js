import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import AppButton from "../ui/AppButton";
import { getEntitlement } from "../api/billing";

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
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text style={styles.text}>Checking subscription…</Text>
            </View>
        );
    }

    if (!entitlement?.isActive) {
        return (
            <View style={styles.card}>
                <Text style={styles.title}>Pro Required</Text>
                <Text style={styles.text}>
                    Upgrade your plan to unlock this feature.
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

const styles = StyleSheet.create({
    center: { marginTop: 40, alignItems: "center", gap: 12 },
    card: {
        marginTop: 24,
        padding: 16,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.06)",
        gap: 12,
    },
    title: { fontSize: 18, fontWeight: "900", color: "#fff" },
    text: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },
});
