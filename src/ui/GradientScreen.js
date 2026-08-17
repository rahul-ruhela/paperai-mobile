import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppGradients } from "./tokens";

/**
 * Full-bleed light background with two soft blue accent glows.
 * (The pink glow was removed to keep the palette on-brand: blue + accent.)
 */
export default function GradientScreen({ children }) {
    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" />
            <LinearGradient
                colors={AppGradients.background}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.glowTop} pointerEvents="none" />
            <View style={styles.glowBottom} pointerEvents="none" />
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    glowTop: {
        position: "absolute",
        top: -120,
        left: -80,
        width: 260,
        height: 260,
        borderRadius: 260,
        backgroundColor: "rgba(79,140,255,0.16)",
    },
    glowBottom: {
        position: "absolute",
        bottom: -150,
        right: -100,
        width: 320,
        height: 320,
        borderRadius: 320,
        backgroundColor: "rgba(255,213,74,0.14)",
    },
});
