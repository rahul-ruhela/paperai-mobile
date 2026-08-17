import React, { useEffect, useMemo, useRef } from "react";
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

export default function ConfirmActionSheet({
    visible,
    title = "Are you sure?",
    message = "",
    confirmText = "Delete",
    cancelText = "Cancel",
    destructive = true,
    icon = "trash-outline",
    onConfirm,
    onCancel,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    const styles = useThemedStyles(makeStyles);

    const sheet = useRef(new Animated.Value(0)).current;
    const backdrop = useRef(new Animated.Value(0)).current;

    const translateY = useMemo(
        () =>
            sheet.interpolate({
                inputRange: [0, 1],
                outputRange: [380, 0],
            }),
        [sheet]
    );

    useEffect(() => {
        if (!visible) return;

        sheet.setValue(0);
        backdrop.setValue(0);

        Animated.parallel([
            Animated.timing(backdrop, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.spring(sheet, {
                toValue: 1,
                friction: 10,
                tension: 90,
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, sheet, backdrop]);

    const close = (cb) => {
        Animated.parallel([
            Animated.timing(backdrop, {
                toValue: 0,
                duration: 140,
                useNativeDriver: true,
            }),
            Animated.timing(sheet, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
            }),
        ]).start(() => cb?.());
    };

    const handleCancel = () => close(onCancel);
    const handleConfirm = () => close(onConfirm);

    const accentColor = theme.isDark ? c.primaryLight : c.primaryDark;

    return (
        <Modal transparent visible={!!visible} animationType="none">
            <View style={styles.root}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel}>
                    <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
                </Pressable>

                <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                    <View style={styles.topRow}>
                        <View style={styles.handle} />
                        <Pressable
                            onPress={handleCancel}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            style={({ pressed }) => [
                                styles.closeBtn,
                                pressed && { opacity: 0.75 },
                            ]}
                        >
                            <Ionicons name="close" size={18} color={c.textPrimary} />
                        </Pressable>
                    </View>

                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconWrap,
                                destructive && styles.iconWrapDestructive,
                            ]}
                        >
                            <Ionicons
                                name={icon}
                                size={18}
                                color={destructive ? c.dangerDark : accentColor}
                            />
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{title}</Text>
                            {!!message && <Text style={styles.message}>{message}</Text>}
                        </View>
                    </View>

                    <Pressable
                        onPress={handleConfirm}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                            styles.confirmBtn,
                            destructive ? styles.confirmBtnDestructive : styles.confirmBtnNormal,
                            pressed && { opacity: 0.9 },
                        ]}
                    >
                        <Text style={styles.confirmText}>{confirmText}</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleCancel}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.9 }]}
                    >
                        <Text style={styles.cancelText}>{cancelText}</Text>
                    </Pressable>

                    <Text style={styles.legal}>This action cannot be undone.</Text>
                </Animated.View>
            </View>
        </Modal>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        root: { flex: 1, justifyContent: "flex-end" },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: t.colors.overlay,
        },

        sheet: {
            backgroundColor: t.colors.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderColor: t.colors.border,
            padding: 16,
            paddingBottom: 18,
            ...(Platform.OS === "ios"
                ? {
                      shadowColor: t.colors.shadowColor,
                      shadowOpacity: t.isDark ? 0.5 : 0.22,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: -6 },
                  }
                : { elevation: 8 }),
        },

        topRow: { height: 18, justifyContent: "center" },
        handle: {
            alignSelf: "center",
            width: 46,
            height: 5,
            borderRadius: 999,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.22)" : "#D1D5DB",
        },
        closeBtn: {
            position: "absolute",
            right: 0,
            top: -4,
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
            borderWidth: 1,
            borderColor: t.colors.border,
        },

        header: {
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            marginTop: 12,
            marginBottom: 12,
        },
        iconWrap: {
            width: 38,
            height: 38,
            borderRadius: 14,
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.isDark ? "rgba(110,168,255,0.30)" : "rgba(79,140,255,0.25)",
            alignItems: "center",
            justifyContent: "center",
        },
        iconWrapDestructive: {
            backgroundColor: t.colors.dangerBg,
            borderColor: t.isDark ? "rgba(255,107,112,0.35)" : "rgba(255,90,95,0.30)",
        },

        title: { color: t.colors.textPrimary, fontSize: 16, fontWeight: "800" },
        message: { marginTop: 4, color: t.colors.textSecondary, fontWeight: "700", lineHeight: 18 },

        confirmBtn: {
            marginTop: 8,
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: "center",
            borderWidth: 1,
        },
        confirmBtnDestructive: {
            backgroundColor: t.colors.danger,
            borderColor: t.isDark ? "rgba(255,107,112,0.45)" : "rgba(255,90,95,0.4)",
        },
        confirmBtnNormal: {
            backgroundColor: t.colors.primary,
            borderColor: t.isDark ? "rgba(110,168,255,0.45)" : "rgba(79,140,255,0.4)",
        },
        confirmText: { color: t.colors.white, fontWeight: "700" },

        cancelBtn: {
            marginTop: 10,
            borderRadius: 18,
            paddingVertical: 14,
            alignItems: "center",
            backgroundColor: t.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
            borderWidth: 1,
            borderColor: t.colors.primary,
        },
        cancelText: {
            color: t.isDark ? t.colors.primaryLight : t.colors.primaryDark,
            fontWeight: "700",
        },

        legal: {
            marginTop: 10,
            color: t.colors.textMuted,
            fontSize: 12,
            textAlign: "center",
            fontWeight: "500",
        },
    });
