import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeContext";

export default function BottomFade() {
    const insets = useSafeAreaInsets();
    const { colors } = (useTheme() as any);
    // Fade to the active page background so the dissolve is invisible seam-wise
    // in both light and dark themes.
    const rgb = colors?.isDark ? "11,16,32" : "245,247,251";

    return (
        <View
            pointerEvents="none"
            style={[
                styles.container,
                { height: 80 + insets.bottom },
            ]}
        >
            <LinearGradient
                colors={[
                    `rgba(${rgb},0)`,
                    `rgba(${rgb},0.65)`,
                    `rgba(${rgb},1)`,
                ]}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
});
