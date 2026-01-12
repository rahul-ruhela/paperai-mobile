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
import { Theme } from "./theme";

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
                            style={({ pressed }) => [
                                styles.closeBtn,
                                pressed && { opacity: 0.75 },
                            ]}
                        >
                            <Ionicons name="close" size={18} color={Theme.colors.text} />
                        </Pressable>
                    </View>

                    <View style={styles.header}>
                        <View
                            style={[
                                styles.iconWrap,
                                destructive && styles.iconWrapDestructive,
                            ]}
                        >
                            <Ionicons name={icon} size={18} color="#fff" />
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{title}</Text>
                            {!!message && <Text style={styles.message}>{message}</Text>}
                        </View>
                    </View>

                    <Pressable
                        onPress={handleConfirm}
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
                        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.9 }]}
                    >
                        <Text style={styles.cancelText}>{cancelText}</Text>
                    </Pressable>

                    <Text style={styles.legal}>
                        This action can’t be undone.
                    </Text>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.70)", // darker (your request)
    },

    sheet: {
        backgroundColor: "rgba(13,20,38,0.98)",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: 16,
        paddingBottom: 18,
        ...(Platform.OS === "ios"
            ? { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: -6 } }
            : { elevation: 8 }),
    },

    topRow: { height: 18, justifyContent: "center" },
    handle: {
        alignSelf: "center",
        width: 46,
        height: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
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
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },

    header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 12, marginBottom: 12 },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    iconWrapDestructive: {
        backgroundColor: "rgba(239,68,68,0.22)",
        borderColor: "rgba(239,68,68,0.28)",
    },

    title: { color: "#fff", fontSize: 16, fontWeight: "900" },
    message: { marginTop: 4, color: Theme.colors.text2, fontWeight: "700", lineHeight: 18 },

    confirmBtn: {
        marginTop: 8,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: "center",
        borderWidth: 1,
    },
    confirmBtnDestructive: {
        backgroundColor: "rgba(239,68,68,0.92)",
        borderColor: "rgba(239,68,68,0.25)",
    },
    confirmBtnNormal: {
        backgroundColor: "rgba(165,180,252,0.25)",
        borderColor: "rgba(165,180,252,0.28)",
    },
    confirmText: { color: "#fff", fontWeight: "900" },

    cancelBtn: {
        marginTop: 10,
        borderRadius: 18,
        paddingVertical: 14,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    cancelText: { color: "rgba(255,255,255,0.85)", fontWeight: "900" },

    legal: {
        marginTop: 10,
        color: "rgba(255,255,255,0.45)",
        fontSize: 12,
        textAlign: "center",
        fontWeight: "700",
    },
});
