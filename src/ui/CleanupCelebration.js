import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import useThemedStyles from "./useThemedStyles";
import { useTheme } from "./ThemeProvider";
import useReduceMotion from "./useReduceMotion";
import { playCleanupSound } from "../services/cleanupSound";

/**
 * CleanupCelebration — the rocket that launches when a cleanup frees space.
 *
 * Shown only after storage was ACTUALLY freed. A celebration for a delete that
 * removed nothing would be a lie, so the caller passes the real byte count and
 * this renders nothing when it is zero.
 *
 * Built on React Native's own Animated rather than Reanimated, to match every
 * other animation in this app.
 *
 * Accessibility: with "Reduce Motion" on, the rocket does not fly — the panel
 * fades in, holds, and fades out. The sound is unaffected, because Reduce
 * Motion is about movement, not audio.
 *
 * The overlay is pointerEvents="none" throughout: a decoration must never be
 * able to swallow a tap meant for the list underneath it.
 */
export default function CleanupCelebration({ visible, bytesFreed, label, soundEnabled = true, onDone }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const reduceMotion = useReduceMotion();

    const lift = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;

    // onDone is read through a ref so that a caller passing an inline arrow
    // does not restart the animation on every parent render.
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        if (!visible) return undefined;

        playCleanupSound(soundEnabled);

        lift.setValue(0);
        fade.setValue(0);

        const sequence = reduceMotion
            ? Animated.sequence([
                  Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
                  Animated.delay(900),
                  Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true }),
              ])
            : Animated.parallel([
                  Animated.sequence([
                      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
                      Animated.delay(620),
                      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
                  ]),
                  Animated.timing(lift, {
                      toValue: 1,
                      duration: 1080,
                      // Slow off the pad, fast at the top — an ease-out would
                      // read as the rocket running out of thrust.
                      easing: Easing.in(Easing.cubic),
                      useNativeDriver: true,
                  }),
              ]);

        sequence.start(({ finished }) => {
            if (finished) onDoneRef.current?.();
        });

        return () => sequence.stop();
    }, [visible, reduceMotion, soundEnabled, lift, fade]);

    if (!visible) return null;

    const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -220] });
    const trailScale = lift.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.2, 1, 0.4] });
    const trailFade = lift.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.85, 0] });

    return (
        <View style={styles.overlay} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View style={[styles.panel, { opacity: fade }]}>
                <View style={styles.rocketColumn}>
                    {!reduceMotion && (
                        <Animated.View
                            style={[
                                styles.trail,
                                { opacity: trailFade, transform: [{ translateY }, { scaleY: trailScale }] },
                            ]}
                        />
                    )}
                    <Animated.View style={{ transform: reduceMotion ? [] : [{ translateY }] }}>
                        <Ionicons name="rocket" size={40} color={theme.colors.accentText} />
                    </Animated.View>
                </View>

                <Text style={styles.freed}>{bytesFreed}</Text>
                <Text style={styles.caption}>{label ?? "freed up"}</Text>
            </Animated.View>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        overlay: {
            ...StyleSheet.absoluteFillObject,
            alignItems: "center",
            justifyContent: "center",
        },
        panel: {
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 28,
            paddingVertical: 22,
            borderRadius: 24,
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            gap: 2,
        },
        rocketColumn: { height: 56, alignItems: "center", justifyContent: "flex-end" },
        trail: {
            position: "absolute",
            bottom: 4,
            width: 4,
            height: 46,
            borderRadius: 2,
            backgroundColor: t.colors.accentText,
        },
        freed: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 26, marginTop: 10 },
        caption: {
            color: t.colors.textMuted,
            fontWeight: "700",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.6,
        },
    });
