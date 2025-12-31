import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AiHeader({ title, subtitle }) {
    const float = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(float, {
                    toValue: -6,
                    duration: 1400,
                    useNativeDriver: true,
                }),
                Animated.timing(float, {
                    toValue: 0,
                    duration: 1400,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.wrap}>
            <Animated.View style={{ transform: [{ translateY: float }] }}>
                <Ionicons name="hardware-chip-outline" size={42} color="#A5B4FC" />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        marginTop: 8,
        fontSize: 26,
        fontWeight: "900",
        color: "#fff",
    },
    sub: {
        marginTop: 4,
        color: "rgba(255,255,255,0.7)",
        fontWeight: "600",
        textAlign: "center",
    },
});
