import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppColors, Radius } from "./tokens";
import AppIcon from "./AppIcon";

/**
 * Small pill badge for status / labels. `tone` picks a semantic palette.
 * Premium/selected highlights use the yellow accent with black text
 * (never yellow text on white). Errors use red, success green, etc.
 */
const TONES = {
    neutral: { bg: "#EEF1F6", fg: AppColors.textSecondary, border: AppColors.border },
    primary: { bg: "rgba(79,140,255,0.12)", fg: AppColors.primaryDark, border: "rgba(79,140,255,0.35)" },
    premium: { bg: AppColors.accent, fg: AppColors.black, border: AppColors.accentLight },
    selected: { bg: AppColors.accent, fg: AppColors.black, border: AppColors.accentLight },
    success: { bg: "rgba(34,197,94,0.14)", fg: "#15803D", border: "rgba(34,197,94,0.35)" },
    warning: { bg: "rgba(245,158,11,0.16)", fg: "#B45309", border: "rgba(245,158,11,0.4)" },
    danger: { bg: "rgba(255,90,95,0.14)", fg: AppColors.dangerDark, border: "rgba(255,90,95,0.4)" },
};

export default function StatusBadge({ label, tone = "neutral", icon, style }) {
    const t = TONES[tone] || TONES.neutral;
    return (
        <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, style]}>
            {icon ? <AppIcon name={icon} size={13} color={t.fg} /> : null}
            <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderWidth: 1,
        borderRadius: Radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
    },
    text: { fontSize: 11, fontWeight: "700" },
});
