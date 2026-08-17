import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Spacing } from "./tokens";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";
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
    const { theme } = useTheme();
    const c = theme.colors;
    const styles = useThemedStyles(makeStyles);

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
                        color={hasError ? c.dangerDark : c.textMuted}
                    />
                ) : null}

                <TextInput
                    style={[styles.input, inputStyle]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={c.placeholder}
                    // Without this the iOS keyboard stays white in dark mode.
                    keyboardAppearance={theme.keyboardAppearance}
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
                        <AppIcon name={hide ? "eye" : "eyeOff"} size={20} color={c.textMuted} />
                    </Pressable>
                ) : hasError ? (
                    <AppIcon name="error" size={20} color={c.dangerDark} />
                ) : null}
            </View>

            {hasError ? (
                <View style={styles.errorRow}>
                    <AppIcon name="warning" size={14} color={c.dangerDark} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: { marginBottom: Spacing.md },
        label: {
            fontSize: 13,
            fontWeight: "600",
            color: t.colors.textSecondary,
            marginBottom: 6,
        },
        field: {
            ...t.input,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
        },
        focused: {
            borderColor: t.colors.primary,
            shadowColor: t.colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 2,
        },
        errored: { borderColor: t.colors.dangerDark },
        input: {
            flex: 1,
            color: t.colors.textPrimary,
            fontSize: 15,
            paddingVertical: 0,
        },
        errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
        errorText: { color: t.colors.dangerDark, fontSize: 13, fontWeight: "600", flex: 1 },
    });
