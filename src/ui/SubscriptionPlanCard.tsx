import React from "react";

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
    title: string;
    price: string;
    selected: boolean;
    onPress: () => void;
    badge?: string;
    highlight?: boolean;
};

export default function SubscriptionPlanCard({
    title,
    price,
    selected,
    onPress,
    badge,
    highlight,
}: Props) {
    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={[
                styles.card,
                selected && styles.selected,
                highlight && styles.highlight,
            ]}
        >
            {badge && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.price}>{price}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#141414",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#222",
    },
    selected: {
        borderColor: "#5B8CFF",
    },
    highlight: {
        borderColor: "#FFD166",
        shadowColor: "#FFD166",
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    title: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 6,
    },
    price: {
        color: "#A0A0A0",
        fontSize: 16,
    },
    badge: {
        position: "absolute",
        top: -10,
        right: 12,
        backgroundColor: "#FFD166",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#000",
    },
});
