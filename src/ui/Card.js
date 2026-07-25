import React from "react";
import { View } from "react-native";
import { GlassCardStyle, Spacing } from "./tokens";

/**
 * Legacy card. Now renders the branded glass surface so existing screens
 * that use <Card> pick up the new look without changes.
 */
export default function Card({ children, style }) {
    return (
        <View style={[{ ...GlassCardStyle, padding: Spacing.md }, style]}>
            {children}
        </View>
    );
}
