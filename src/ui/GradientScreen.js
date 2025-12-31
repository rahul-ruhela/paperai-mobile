import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GradientScreen({ children }) {
    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={["#0B1220", "#111B33", "#1C2A57"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {/* soft “glow” layer */}
            <View style={styles.glowTop} />
            <View style={styles.glowBottom} />
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
        backgroundColor: "rgba(99,102,241,0.28)",
    },
    glowBottom: {
        position: "absolute",
        bottom: -140,
        right: -90,
        width: 300,
        height: 300,
        borderRadius: 300,
        backgroundColor: "rgba(236,72,153,0.18)",
    },
});
