import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeContext";

/**
 * Full-bleed page background with two soft accent glows. Theme-aware: the
 * gradient, glows and status-bar content all follow the active light/dark scheme.
 */
export default function GradientScreen({ children }) {
    const { colors } = useTheme();
    return (
        <View style={styles.root}>
            <StatusBar barStyle={colors.statusBar} />
            <LinearGradient
                colors={colors.bgGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View
                style={[styles.glowTop, { backgroundColor: colors.isDark ? "rgba(79,140,255,0.14)" : "rgba(79,140,255,0.16)" }]}
                pointerEvents="none"
            />
            <View
                style={[styles.glowBottom, { backgroundColor: colors.isDark ? "rgba(255,213,74,0.08)" : "rgba(255,213,74,0.14)" }]}
                pointerEvents="none"
            />
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
    },
    glowBottom: {
        position: "absolute",
        bottom: -150,
        right: -100,
        width: 320,
        height: 320,
        borderRadius: 320,
    },
});
