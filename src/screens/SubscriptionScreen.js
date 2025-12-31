import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AiHeader from "../ui/AiHeader";
import AppButton from "../ui/AppButton";

export default function SubscriptionScreen() {
    const [selected, setSelected] = useState("PRO");

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <AiHeader
                        title="Choose Your Plan"
                        subtitle="Unlock more AI power with credits"
                    />

                    <Plan
                        title="Basic"
                        price="$5 / month"
                        credits="500 credits"
                        selected={selected === "BASIC"}
                        onPress={() => setSelected("BASIC")}
                    />

                    <Plan
                        title="Intermediate"
                        price="$15 / month"
                        credits="2,000 credits"
                        selected={selected === "MID"}
                        onPress={() => setSelected("MID")}
                    />

                    <Plan
                        title="Pro"
                        price="$29 / month"
                        credits="Unlimited credits"
                        highlight
                        selected={selected === "PRO"}
                        onPress={() => setSelected("PRO")}
                    />

                    <AppButton title="Continue" />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Plan({ title, price, credits, selected, onPress, highlight }) {
    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.plan,
                selected && styles.selected,
                highlight && styles.highlight,
            ]}
        >
            <Text style={styles.planTitle}>{title}</Text>
            <Text style={styles.planPrice}>{price}</Text>
            <Text style={styles.planCredits}>{credits}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },

    plan: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    selected: {
        borderColor: "#A5B4FC",
    },
    highlight: {
        backgroundColor: "rgba(165,180,252,0.15)",
    },
    planTitle: {
        fontSize: 18,
        fontWeight: "900",
        color: "#fff",
    },
    planPrice: {
        marginTop: 6,
        color: "#A5B4FC",
        fontWeight: "800",
    },
    planCredits: {
        marginTop: 4,
        color: "rgba(255,255,255,0.7)",
        fontWeight: "600",
    },
});
