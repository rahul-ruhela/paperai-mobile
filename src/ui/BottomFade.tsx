import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeProvider";

export default function BottomFade() {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();

    return (
        <View
            pointerEvents="none"
            style={[styles.container, { height: 80 + insets.bottom }]}
        >
            <LinearGradient
                colors={theme.fade as [string, string, string]}
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
