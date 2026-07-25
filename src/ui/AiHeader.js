import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import AppIcon from "./AppIcon";
import { AppColors } from "./tokens";
import useReduceMotion from "./useReduceMotion";

export default function AiHeader({ title, subtitle }) {
    const float = useRef(new Animated.Value(0)).current;
    const reduceMotion = useReduceMotion();

    useEffect(() => {
        if (reduceMotion) {
            float.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(float, { toValue: -6, duration: 1400, useNativeDriver: true }),
                Animated.timing(float, { toValue: 0, duration: 1400, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [reduceMotion]);

    return (
        <View style={styles.wrap}>
            <Animated.View style={{ transform: [{ translateY: float }] }}>
                <AppIcon name="sparkle" size={42} color={AppColors.primary} />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: "center", marginBottom: 16 },
    title: {
        marginTop: 8,
        fontSize: 26,
        fontWeight: "800",
        color: AppColors.textPrimary,
    },
    sub: {
        marginTop: 4,
        color: AppColors.textMuted,
        fontWeight: "500",
        textAlign: "center",
    },
});
