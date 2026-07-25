import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Animated } from "react-native";
import { AppColors, Spacing, Radius } from "./tokens";
import AppIcon from "./AppIcon";
import { PrimaryButton } from "./buttons";
import useReduceMotion from "./useReduceMotion";

/** Subtle fade-in wrapper using the built-in Animated API (no Babel plugin). */
function FadeIn({ style, children }) {
    const reduceMotion = useReduceMotion();
    const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

    useEffect(() => {
        if (reduceMotion) {
            opacity.setValue(1);
            return;
        }
        Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [reduceMotion]);

    return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}

/* =======================
   LoadingView
======================= */
export function LoadingView({ label = "Loading…", style }) {
    return (
        <View style={[styles.center, style]} accessibilityRole="progressbar" accessibilityLabel={label}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            {label ? <Text style={styles.subtle}>{label}</Text> : null}
        </View>
    );
}

/* =======================
   ErrorView
======================= */
export function ErrorView({ title = "Something went wrong", message, onRetry, retryLabel = "Try again", style }) {
    return (
        <FadeIn style={[styles.center, style]}>
            <View style={[styles.iconWrap, { backgroundColor: "rgba(255,90,95,0.12)" }]}>
                <AppIcon name="error" size={30} color={AppColors.dangerDark} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.subtle}>{message}</Text> : null}
            {onRetry ? (
                <PrimaryButton title={retryLabel} icon="refresh" onPress={onRetry} fullWidth={false} style={{ marginTop: Spacing.lg }} />
            ) : null}
        </FadeIn>
    );
}

/* =======================
   EmptyState
======================= */
export function EmptyState({ icon = "document", title, message, actionLabel, onAction, style }) {
    return (
        <FadeIn style={[styles.center, style]}>
            <View style={styles.iconWrap}>
                <AppIcon name={icon} size={30} color={AppColors.primary} />
            </View>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {message ? <Text style={styles.subtle}>{message}</Text> : null}
            {actionLabel && onAction ? (
                <PrimaryButton title={actionLabel} onPress={onAction} fullWidth={false} style={{ marginTop: Spacing.lg }} />
            ) : null}
        </FadeIn>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: Spacing.xl,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: Radius.xl,
        backgroundColor: "rgba(79,140,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: 17,
        fontWeight: "700",
        color: AppColors.textPrimary,
        textAlign: "center",
    },
    subtle: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: "500",
        color: AppColors.textMuted,
        textAlign: "center",
        lineHeight: 19,
    },
});
