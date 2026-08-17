import React from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppColors, AppGradients } from "./tokens";
import BottomFade from "./BottomFade";

/**
 * Base page wrapper: soft light background gradient + safe-area aware
 * bottom padding + a fade so scrolled content dissolves above the tab bar.
 */
export default function ScreenContainer({ children, padded = false, fade = true }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <LinearGradient
                colors={AppGradients.background}
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

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: AppColors.background,
    },
    content: {
        flex: 1,
    },
});
