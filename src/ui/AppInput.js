import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { AppColors, InputStyle, Radius, Spacing } from "./tokens";
import AppIcon from "./AppIcon";

/**
 * Themed text input with label, focus glow, error state (icon + message,
 * never color alone) and optional trailing action (e.g. password toggle).
 */
export default function AppInput({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    icon,
    secureTextEntry,
    style,
    inputStyle,
    ...rest
}) {
    const [focused, setFocused] = useState(false);
    const [hide, setHide] = useState(!!secureTextEntry);

    const hasError = !!error;

    return (
        <View style={[styles.wrap, style]}>
            {label ? <Text style={styles.label}>{label}</Text> : null}

            <View
                style={[
                    styles.field,
                    focused && styles.focused,
                    hasError && styles.errored,
                ]}
            >
                {icon ? (
                    <AppIcon
                        name={icon}
                        size={20}
                        color={hasError ? AppColors.dangerDark : AppColors.textMuted}
                    />
                ) : null}

                <TextInput
                    style={[styles.input, inputStyle]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={AppColors.textMuted}
                    secureTextEntry={hide}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    {...rest}
                />

                {secureTextEntry ? (
                    <Pressable
                        onPress={() => setHide((h) => !h)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={hide ? "Show password" : "Hide password"}
                    >
                        <AppIcon name={hide ? "eye" : "eyeOff"} size={20} color={AppColors.textMuted} />
                    </Pressable>
                ) : hasError ? (
                    <AppIcon name="error" size={20} color={AppColors.dangerDark} />
                ) : null}
            </View>

            {hasError ? (
                <View style={styles.errorRow}>
                    <AppIcon name="warning" size={14} color={AppColors.dangerDark} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: Spacing.md },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: AppColors.textSecondary,
        marginBottom: 6,
    },
    field: {
        ...InputStyle,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    focused: {
        borderColor: AppColors.primary,
        shadowColor: AppColors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 2,
    },
    errored: { borderColor: AppColors.dangerDark },
    input: {
        flex: 1,
        color: AppColors.textPrimary,
        fontSize: 15,
        paddingVertical: 0,
    },
    errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
    errorText: { color: AppColors.dangerDark, fontSize: 13, fontWeight: "600", flex: 1 },
});
