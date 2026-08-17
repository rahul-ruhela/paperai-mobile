import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Radius } from "./tokens";
import { useTheme } from "./ThemeProvider";
import AppIcon from "./AppIcon";

/**
 * Small pill badge for status / labels. `tone` picks a semantic palette.
 * Premium/selected highlights use the yellow accent with black text
 * (never yellow text on white). Errors use red, success green, etc.
 *
 * Tones are derived from the active theme so the badge stays legible in both
 * appearances — on dark the tinted fills sit on a near-black page, so the
 * foregrounds shift to the lighter end of each ramp.
 */
function tonesFor(t) {
    const c = t.colors;
    return {
        neutral: {
            bg: t.isDark ? "rgba(255,255,255,0.08)" : "#EEF1F6",
            fg: c.textSecondary,
            border: c.border,
        },
        primary: {
            bg: c.infoBg,
            fg: t.isDark ? c.primaryLight : c.primaryDark,
            border: t.isDark ? "rgba(110,168,255,0.40)" : "rgba(79,140,255,0.35)",
        },
        premium: { bg: c.accent, fg: c.onAccent, border: c.accentLight },
        selected: { bg: c.accent, fg: c.onAccent, border: c.accentLight },
        success: {
            bg: c.successBg,
            fg: t.isDark ? c.success : "#15803D",
            border: t.isDark ? "rgba(52,211,153,0.40)" : "rgba(34,197,94,0.35)",
        },
        warning: {
            bg: c.warningBg,
            fg: t.isDark ? c.warning : "#B45309",
            border: t.isDark ? "rgba(251,191,36,0.40)" : "rgba(245,158,11,0.4)",
        },
        danger: {
            bg: c.dangerBg,
            fg: c.dangerDark,
            border: t.isDark ? "rgba(255,107,112,0.40)" : "rgba(255,90,95,0.4)",
        },
    };
}

export default function StatusBadge({ label, tone = "neutral", icon, style }) {
    const { theme } = useTheme();
    const tones = tonesFor(theme);
    const t = tones[tone] || tones.neutral;

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
