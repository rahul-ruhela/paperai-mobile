import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Theme } from "./theme";

export default function GradientScreen({ children }) {
    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[Theme.colors.bg0, Theme.colors.bg1, Theme.colors.bg2]}
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
        backgroundColor: "rgba(99,102,241,0.26)",
    },
    glowBottom: {
        position: "absolute",
        bottom: -150,
        right: -100,
        width: 320,
        height: 320,
        borderRadius: 320,
        backgroundColor: "rgba(236,72,153,0.18)",
    },
});
