import React, { useEffect, useRef } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { AppColors, GlassCardStyle, Spacing } from "./tokens";
import AppIcon from "./AppIcon";
import useReduceMotion from "./useReduceMotion";

/**
 * Centered glass modal with a dimmed backdrop. Tapping the backdrop or the
 * close button dismisses. Entrance animates with React Native's built-in
 * Animated API (no Babel plugin), and respects Reduce Motion.
 */
export default function GlassModal({ visible, onClose, title, children }) {
    const reduceMotion = useReduceMotion();
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) {
            progress.setValue(0);
            return;
        }
        if (reduceMotion) {
            progress.setValue(1);
            return;
        }
        Animated.timing(progress, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [visible, reduceMotion]);

    const sheetStyle = {
        opacity: progress,
        transform: [
            {
                translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                }),
            },
        ],
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
                <Animated.View style={[styles.card, sheetStyle]}>
                    {title ? (
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <Pressable
                                onPress={onClose}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <AppIcon name="close" size={22} color={AppColors.textMuted} />
                            </Pressable>
                        </View>
                    ) : null}
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(17,17,17,0.45)",
        justifyContent: "center",
        paddingHorizontal: Spacing.lg,
    },
    card: {
        ...GlassCardStyle,
        backgroundColor: AppColors.surface,
        padding: Spacing.lg,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: Spacing.md,
    },
    title: { fontSize: 17, fontWeight: "700", color: AppColors.textPrimary, flex: 1 },
});
