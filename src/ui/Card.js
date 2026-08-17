import React from "react";
import { View } from "react-native";
import { Spacing } from "./tokens";
import { useTheme } from "./ThemeProvider";

/**
 * Legacy card. Renders the branded glass surface so existing screens that use
 * <Card> pick up the active theme without changes.
 */
export default function Card({ children, style }) {
    const { theme } = useTheme();

    return (
        <View style={[{ ...theme.glassCard, padding: Spacing.md }, style]}>
            {children}
        </View>
    );
}
