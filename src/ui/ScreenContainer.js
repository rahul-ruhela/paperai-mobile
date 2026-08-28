import React from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";
import BottomFade from "./BottomFade";

/**
 * Base page wrapper: themed background gradient + safe-area aware bottom
 * padding + a fade so scrolled content dissolves above the tab bar.
 */
export default function ScreenContainer({ children, padded = false, fade = true }) {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    return (
        <View style={styles.root}>
            <StatusBar style={theme.statusBarStyle} translucent />
            <LinearGradient
                colors={theme.gradients.background}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View
                style={[
                    styles.content,
                    padded && { paddingHorizontal: 16 },
                    { paddingBottom: insets.bottom + 80 },
                ]}
            >
                {children}
            </View>

            {fade ? <BottomFade /> : null}
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: t.colors.background,
        },
        content: {
            flex: 1,
        },
    });
