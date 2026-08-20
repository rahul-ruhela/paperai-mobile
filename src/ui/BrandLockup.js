import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AiOrb from "./AiOrb";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * BrandLockup — the single brand mark used on every entry point (boot, login,
 * register, OTP). One component so the identity can never drift between screens.
 *
 * The orb *is* the logo: the same animated core that appears on Home and in the
 * scanners, so the first thing a user sees is the thing they will keep seeing.
 *
 * `pillars` renders the three-word value proposition. This matters commercially —
 * "PaperAI" alone says nothing, while "Analyze · Sign · Clean" tells a new user
 * in one glance that this is more than another scanner app.
 */
export default function BrandLockup({
    size = "lg",
    tagline = "Analyze, sign and clean up your documents — in one place.",
    pillars = true,
    state = "idle",
    style,
}) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const orbSize = size === "sm" ? 96 : size === "md" ? 128 : 150;

    return (
        <View style={[styles.wrap, style]}>
            <AiOrb size={orbSize} state={state} />

            <View style={styles.wordmarkRow}>
                <Text style={styles.wordPaper}>Paper</Text>
                <Text style={styles.wordAi}>AI</Text>
            </View>

            {!!tagline && <Text style={styles.tagline}>{tagline}</Text>}

            {pillars && (
                <View style={styles.pillars}>
                    <Pillar icon="sparkles-outline" label="Analyze" />
                    <Dot />
                    <Pillar icon="create-outline" label="Sign" />
                    <Dot />
                    <Pillar icon="trash-bin-outline" label="Clean" />
                </View>
            )}
        </View>
    );
}

function Pillar({ icon, label }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.pillar}>
            <Ionicons name={icon} size={13} color={theme.colors.accentText} />
            <Text style={styles.pillarText}>{label}</Text>
        </View>
    );
}

function Dot() {
    const styles = useThemedStyles(makeStyles);
    return <View style={styles.pillarDot} />;
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: { alignItems: "center" },

        wordmarkRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10 },
        wordPaper: {
            fontSize: 32,
            fontWeight: "800",
            color: t.colors.textPrimary,
            letterSpacing: -0.5,
        },
        // The "AI" carries the accent — it is the half of the name that means something.
        wordAi: {
            fontSize: 32,
            fontWeight: "900",
            color: t.colors.accentText,
            letterSpacing: -0.5,
        },

        tagline: {
            marginTop: 8,
            color: t.colors.textMuted,
            fontWeight: "600",
            fontSize: 13,
            textAlign: "center",
            lineHeight: 19,
            paddingHorizontal: 24,
        },

        pillars: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 14,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        pillar: { flexDirection: "row", alignItems: "center", gap: 5 },
        pillarText: {
            color: t.colors.textSecondary,
            fontWeight: "800",
            fontSize: 11.5,
            letterSpacing: 0.3,
        },
        pillarDot: {
            width: 3,
            height: 3,
            borderRadius: 3,
            backgroundColor: t.colors.textMuted,
            opacity: 0.6,
        },
    });
