import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * Full-bleed background with two soft accent glows.
 * Light: soft blue-grey wash. Dark: the original near-black ramp.
 */
export default function GradientScreen({ children }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    return (
        <View style={styles.root}>
            <StatusBar style={theme.statusBarStyle} />
            <LinearGradient
                colors={theme.gradients.background}
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

const makeStyles = (t) =>
    StyleSheet.create({
        root: { flex: 1, backgroundColor: t.colors.background },
        glowTop: {
            position: "absolute",
            top: -120,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: 260,
            // Dark mode needs a dimmer glow or it blooms into a grey fog.
            backgroundColor: t.isDark ? "rgba(79,140,255,0.10)" : "rgba(79,140,255,0.16)",
        },
        glowBottom: {
            position: "absolute",
            bottom: -150,
            right: -100,
            width: 320,
            height: 320,
            borderRadius: 320,
            backgroundColor: t.isDark ? "rgba(255,213,74,0.07)" : "rgba(255,213,74,0.14)",
        },
    });
