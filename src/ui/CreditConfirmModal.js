import React, { useEffect, useRef, useMemo } from "react";
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * CreditConfirmModal
 *
 * Shows a bottom sheet before every paid action with:
 *  - Feature name
 *  - Credit cost (fetched from backend, never hardcoded)
 *  - Privacy/safety notice
 *  - Cancel and Confirm buttons
 *
 * Props:
 *   visible        boolean
 *   title          string  — modal title
 *   message        string  — body text (supports {credits} and {count} placeholders)
 *   creditCost     number  — credits this action will use
 *   confirmText    string  — confirm button label (default: "Continue and Use X Credits")
 *   loading        boolean — shows spinner on confirm button while backend responds
 *   onConfirm      fn
 *   onCancel       fn
 *   safetyNote     string  — optional override for bottom safety note
 */
export default function CreditConfirmModal({
    visible,
    title = "Credits Required",
    message = "",
    creditCost = 0,
    confirmText,
    loading = false,
    onConfirm,
    onCancel,
    safetyNote,
}) {
    const sheet = useRef(new Animated.Value(0)).current;
    const backdrop = useRef(new Animated.Value(0)).current;

    const translateY = useMemo(
        () => sheet.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }),
        [sheet]
    );

    useEffect(() => {
        if (!visible) return;
        sheet.setValue(0);
        backdrop.setValue(0);
        Animated.parallel([
            Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(sheet, { toValue: 1, friction: 10, tension: 90, useNativeDriver: true }),
        ]).start();
    }, [visible, sheet, backdrop]);

    function close(cb) {
        Animated.parallel([
            Animated.timing(backdrop, { toValue: 0, duration: 140, useNativeDriver: true }),
            Animated.timing(sheet, { toValue: 0, duration: 160, useNativeDriver: true }),
        ]).start(() => cb?.());
    }

    const handleCancel = () => close(onCancel);
    const handleConfirm = () => { if (!loading) close(onConfirm); };

    // Replace {credits} and {count} placeholders in the message
    const resolvedMessage = message
        .replace("{credits}", String(creditCost))
        .replace("{count}", String(creditCost));

    const confirmLabel = confirmText ?? (
        creditCost > 0 ? `Continue and Use ${creditCost} Credits` : "Continue"
    );

    const resolvedSafetyNote = safetyNote ??
        "Your files and photos are only processed for this feature and are never shared or sold.";

    return (
        <Modal transparent visible={!!visible} animationType="none" statusBarTranslucent>
            <View style={styles.root}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel}>
                    <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
                </Pressable>

                <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                    {/* Handle */}
                    <View style={styles.handleWrap}>
                        <View style={styles.handle} />
                        <Pressable
                            onPress={handleCancel}
                            hitSlop={12}
                            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="close" size={17} color="rgba(255,255,255,0.7)" />
                        </Pressable>
                    </View>

                    {/* Header row */}
                    <View style={styles.headerRow}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="flash" size={20} color="#A5B4FC" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{title}</Text>
                            {creditCost > 0 && (
                                <View style={styles.costRow}>
                                    <Ionicons name="flash-outline" size={13} color="#FBBF24" />
                                    <Text style={styles.costText}>{creditCost} credits will be used</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Message */}
                    {!!resolvedMessage && (
                        <Text style={styles.message}>{resolvedMessage}</Text>
                    )}

                    {/* Safety notice */}
                    <View style={styles.safetyBox}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                        <Text style={styles.safetyText}>{resolvedSafetyNote}</Text>
                    </View>

                    {/* Confirm button */}
                    <Pressable
                        onPress={handleConfirm}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.confirmBtn,
                            pressed && !loading && { opacity: 0.88 },
                            loading && { opacity: 0.65 },
                        ]}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="flash" size={16} color="#fff" />
                                <Text style={styles.confirmText}>{confirmLabel}</Text>
                            </>
                        )}
                    </Pressable>

                    {/* Cancel button */}
                    <Pressable
                        onPress={handleCancel}
                        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.72)",
    },
    sheet: {
        backgroundColor: "rgba(13,20,38,0.98)",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        padding: 18,
        paddingBottom: Platform.OS === "ios" ? 32 : 20,
        gap: 12,
        ...(Platform.OS === "ios"
            ? { shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -8 } }
            : { elevation: 10 }),
    },
    handleWrap: {
        height: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
    },
    closeBtn: {
        position: "absolute",
        right: 0,
        top: -2,
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginTop: 4,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: "rgba(99,102,241,0.22)",
        borderWidth: 1,
        borderColor: "rgba(165,180,252,0.30)",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "900",
    },
    costRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 3,
    },
    costText: {
        color: "#FBBF24",
        fontWeight: "800",
        fontSize: 13,
    },
    message: {
        color: "rgba(255,255,255,0.75)",
        fontWeight: "700",
        lineHeight: 20,
        fontSize: 14,
    },
    safetyBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "rgba(52,211,153,0.08)",
        borderWidth: 1,
        borderColor: "rgba(52,211,153,0.20)",
        borderRadius: 12,
        padding: 10,
    },
    safetyText: {
        flex: 1,
        color: "rgba(255,255,255,0.65)",
        fontSize: 12,
        fontWeight: "700",
        lineHeight: 17,
    },
    confirmBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "rgba(99,102,241,0.85)",
        borderRadius: 18,
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: "rgba(165,180,252,0.30)",
    },
    confirmText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 15,
    },
    cancelBtn: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 13,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    cancelText: {
        color: "rgba(255,255,255,0.80)",
        fontWeight: "900",
        fontSize: 15,
    },
});
