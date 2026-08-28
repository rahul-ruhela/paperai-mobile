import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Spacing } from "./tokens";
import useThemedStyles from "./useThemedStyles";
import useReduceMotion from "./useReduceMotion";

/**
 * Translucent "glass" surface with a soft shadow.
 * Uses an rgba fallback (no native blur dependency) and animates a subtle
 * entrance with React Native's built-in Animated API (no Babel plugin).
 */
export default function GlassCard({ children, style, entering = true, delay = 0 }) {
    const reduceMotion = useReduceMotion();
    const styles = useThemedStyles(makeStyles);
    const progress = useRef(new Animated.Value(entering ? 0 : 1)).current;

    useEffect(() => {
        if (!entering || reduceMotion) {
            progress.setValue(1);
            return;
        }
        Animated.timing(progress, {
            toValue: 1,
            duration: 280,
            delay,
            useNativeDriver: true,
        }).start();
    }, [entering, reduceMotion]);

    const animatedStyle = {
        opacity: progress,
        transform: [
            {
                translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                }),
            },
        ],
    };

    return (
        <Animated.View style={[styles.card, animatedStyle, style]}>
            {children}
        </Animated.View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        card: {
            ...t.glassCard,
            padding: Spacing.md,
        },
    });
