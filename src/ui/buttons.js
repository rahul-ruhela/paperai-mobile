import React, { useRef } from "react";
import { Text, View, ActivityIndicator, Pressable, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
    AppColors,
    AppGradients,
    Radius,
    Shadows,
    Motion,
    MIN_TOUCH,
} from "./tokens";
import AppIcon from "./AppIcon";
import useReduceMotion from "./useReduceMotion";

/**
 * Shared pressable that scales 1 -> 0.97 on press (respecting Reduce Motion).
 * Uses React Native's built-in Animated API — no Babel plugin required.
 * Used by every button variant so press feedback is identical everywhere.
 */
function PressScale({ children, onPress, disabled, style, accessibilityLabel, accessibilityHint }) {
    const scale = useRef(new Animated.Value(1)).current;
    const reduceMotion = useReduceMotion();

    const animateTo = (toValue) =>
        Animated.timing(scale, {
            toValue,
            duration: Motion.fast,
            useNativeDriver: true,
        }).start();

    return (
        <Animated.View style={[{ transform: [{ scale }] }, style]}>
            <Pressable
                onPress={onPress}
                disabled={disabled}
                onPressIn={() => {
                    if (!reduceMotion) animateTo(Motion.pressScale);
                }}
                onPressOut={() => animateTo(1)}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!disabled }}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
                style={{ width: "100%" }}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
}

const base = StyleSheet.create({
    root: {
        minHeight: 52,
        minWidth: MIN_TOUCH,
        borderRadius: Radius.md,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
        overflow: "hidden",
    },
    content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    label: { fontSize: 15, fontWeight: "600" },
    fill: { ...StyleSheet.absoluteFillObject },
});

function Inner({ icon, title, textColor, loading, iconSize = 20 }) {
    if (loading) return <ActivityIndicator color={textColor} />;
    return (
        <View style={base.content}>
            {icon ? <AppIcon name={icon} size={iconSize} color={textColor} /> : null}
            <Text style={[base.label, { color: textColor }]} numberOfLines={1}>
                {title}
            </Text>
        </View>
    );
}

/* =======================
   Primary — blue gradient
======================= */
export function PrimaryButton({ title, onPress, disabled, loading, icon, style, fullWidth = true }) {
    const isDisabled = disabled || loading;
    return (
        <PressScale
            onPress={onPress}
            disabled={isDisabled}
            accessibilityLabel={title}
            style={[
                fullWidth && { alignSelf: "stretch" },
                !isDisabled && Shadows.button,
                style,
            ]}
        >
            {isDisabled ? (
                <View style={[base.root, { backgroundColor: AppColors.disabled }]}>
                    <Inner icon={icon} title={title} textColor={AppColors.disabledText} loading={loading} />
                </View>
            ) : (
                <LinearGradient
                    colors={AppGradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={base.root}
                >
                    <Inner icon={icon} title={title} textColor={AppColors.white} />
                </LinearGradient>
            )}
        </PressScale>
    );
}

/* =======================
   Secondary — glass w/ blue border
======================= */
export function SecondaryButton({ title, onPress, disabled, loading, icon, style, fullWidth = true }) {
    const isDisabled = disabled || loading;
    return (
        <PressScale
            onPress={onPress}
            disabled={isDisabled}
            accessibilityLabel={title}
            style={[fullWidth && { alignSelf: "stretch" }, style]}
        >
            <View
                style={[
                    base.root,
                    {
                        backgroundColor: isDisabled ? AppColors.disabled : "rgba(255,255,255,0.72)",
                        borderWidth: 1,
                        borderColor: isDisabled ? AppColors.inputBorder : AppColors.primary,
                    },
                ]}
            >
                <Inner
                    icon={icon}
                    title={title}
                    textColor={isDisabled ? AppColors.disabledText : AppColors.primaryDark}
                    loading={loading}
                />
            </View>
        </PressScale>
    );
}

/* =======================
   Danger — red gradient (destructive only)
======================= */
export function DangerButton({ title, onPress, disabled, loading, icon, style, fullWidth = true }) {
    const isDisabled = disabled || loading;
    return (
        <PressScale
            onPress={onPress}
            disabled={isDisabled}
            accessibilityLabel={title}
            style={[fullWidth && { alignSelf: "stretch" }, !isDisabled && Shadows.button, style]}
        >
            {isDisabled ? (
                <View style={[base.root, { backgroundColor: AppColors.disabled }]}>
                    <Inner icon={icon} title={title} textColor={AppColors.disabledText} loading={loading} />
                </View>
            ) : (
                <LinearGradient
                    colors={AppGradients.danger}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={base.root}
                >
                    <Inner icon={icon} title={title} textColor={AppColors.white} />
                </LinearGradient>
            )}
        </PressScale>
    );
}

export { PressScale };
