import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "./ThemeProvider";
import useReduceMotion from "./useReduceMotion";

/**
 * AiOrb — the app's shared "AI is alive" visual.
 *
 * Lifts the animation vocabulary already proven in JunkWiperScanScreen
 * (breathing glow, orbiting particles, sweeping scan line) into one component
 * so Home, Upload and the scanners all read as the same product.
 *
 * Built on the RN Animated API with useNativeDriver, matching the rest of the
 * codebase — no reanimated worklets involved, so it runs anywhere Expo Go does.
 *
 * States:
 *   idle       — slow blue breathing, "ready"
 *   working    — faster pulse + active scan line
 *   done       — settles to green
 *
 * Honours the OS Reduce Motion setting: every loop is skipped and the orb
 * renders as a static, still-attractive badge.
 */

const PARTICLE_COUNT = 6;

export default function AiOrb({
    size = 168,
    state = "idle",
    onPress,
    label,
    sublabel,
    style,
}) {
    const { theme } = useTheme();
    const reduceMotion = useReduceMotion();

    const breathe = useRef(new Animated.Value(0)).current;
    const spin = useRef(new Animated.Value(0)).current;
    const sweep = useRef(new Animated.Value(0)).current;
    const press = useRef(new Animated.Value(1)).current;
    // One shared driver for all particles; each dot reads it at a phase offset.
    const orbit = useRef(new Animated.Value(0)).current;

    const loops = useRef([]);

    useEffect(() => {
        // Stop whatever the previous state was running before starting anew.
        loops.current.forEach((l) => l.stop());
        loops.current = [];

        if (reduceMotion) {
            breathe.setValue(0.5);
            spin.setValue(0);
            sweep.setValue(0);
            orbit.setValue(0);
            return;
        }

        const fast = state === "working";

        const mk = (value, duration, easing = Easing.inOut(Easing.ease)) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(value, {
                        toValue: 1,
                        duration,
                        easing,
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: 0,
                        duration,
                        easing,
                        useNativeDriver: true,
                    }),
                ])
            );

        const mkSpin = (value, duration) =>
            Animated.loop(
                Animated.timing(value, {
                    toValue: 1,
                    duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );

        loops.current = [
            mk(breathe, fast ? 900 : 2200),
            mkSpin(spin, fast ? 5000 : 14000),
            mkSpin(orbit, fast ? 4200 : 11000),
            mkSpin(sweep, fast ? 1600 : 4000),
        ];
        loops.current.forEach((l) => l.start());

        return () => {
            loops.current.forEach((l) => l.stop());
            loops.current = [];
        };
    }, [state, reduceMotion, breathe, spin, sweep, orbit]);

    const palette =
        state === "done"
            ? [theme.colors.success, theme.colors.successText]
            : [theme.colors.primary, theme.colors.primaryLight];

    const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
    const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
    const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });
    const ringSpin = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const ringSpinBack = spin.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
    const sweepY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-size / 2, size / 2] });
    const sweepOpacity = sweep.interpolate({
        inputRange: [0, 0.15, 0.85, 1],
        outputRange: [0, 0.55, 0.55, 0],
    });

    function handlePressIn() {
        Animated.spring(press, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start();
    }
    function handlePressOut() {
        Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
    }

    const core = size * 0.52;
    const styles = makeStyles(theme, size, core);

    const icon =
        state === "done" ? "checkmark" : state === "working" ? "scan-outline" : "sparkles";

    return (
        <Pressable
            onPress={onPress}
            onPressIn={onPress ? handlePressIn : undefined}
            onPressOut={onPress ? handlePressOut : undefined}
            disabled={!onPress}
            accessibilityRole={onPress ? "button" : "image"}
            accessibilityLabel={label || "AI assistant"}
            style={[styles.wrap, style]}
        >
            <Animated.View style={[styles.stage, { transform: [{ scale: press }] }]}>
                {/* Outer breathing halo */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.halo,
                        {
                            backgroundColor: palette[0],
                            opacity: haloOpacity,
                            transform: [{ scale: haloScale }],
                        },
                    ]}
                />

                {/* Two counter-rotating rings */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.ring,
                        { borderColor: palette[1], transform: [{ rotate: ringSpin }] },
                    ]}
                />
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.ringInner,
                        { borderColor: palette[0], transform: [{ rotate: ringSpinBack }] },
                    ]}
                />

                {/* Orbiting particles */}
                {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
                    const phase = i / PARTICLE_COUNT;
                    const rotate = orbit.interpolate({
                        inputRange: [0, 1],
                        outputRange: [`${phase * 360}deg`, `${phase * 360 + 360}deg`],
                    });
                    const radius = size / 2 - (i % 2 === 0 ? 6 : 20);
                    return (
                        <Animated.View
                            key={i}
                            pointerEvents="none"
                            style={[styles.particleTrack, { transform: [{ rotate }] }]}
                        >
                            <View
                                style={[
                                    styles.particle,
                                    {
                                        top: size / 2 - radius,
                                        backgroundColor: i % 2 === 0 ? palette[1] : palette[0],
                                        opacity: i % 2 === 0 ? 0.9 : 0.5,
                                    },
                                ]}
                            />
                        </Animated.View>
                    );
                })}

                {/* Core */}
                <Animated.View style={{ transform: [{ scale: coreScale }] }}>
                    <LinearGradient
                        colors={palette}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.core}
                    >
                        <Ionicons name={icon} size={core * 0.42} color={theme.colors.white} />
                    </LinearGradient>
                </Animated.View>

                {/* Scan-line sweep — only meaningful while working */}
                {state === "working" && !reduceMotion && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.sweep,
                            {
                                backgroundColor: palette[1],
                                opacity: sweepOpacity,
                                transform: [{ translateY: sweepY }],
                            },
                        ]}
                    />
                )}
            </Animated.View>

            {!!label && <Text style={styles.label}>{label}</Text>}
            {!!sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
        </Pressable>
    );
}

const makeStyles = (t, size, core) =>
    StyleSheet.create({
        wrap: { alignItems: "center", justifyContent: "center" },
        stage: {
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderRadius: size,
        },
        halo: {
            position: "absolute",
            width: size * 0.86,
            height: size * 0.86,
            borderRadius: size,
        },
        ring: {
            position: "absolute",
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size,
            borderWidth: 1,
            // Dashes are faked by leaving two edges transparent — cheaper than SVG.
            borderTopColor: "transparent",
            borderRightColor: "transparent",
        },
        ringInner: {
            position: "absolute",
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size,
            borderWidth: 1,
            borderBottomColor: "transparent",
            borderLeftColor: "transparent",
            opacity: 0.7,
        },
        particleTrack: {
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
        },
        particle: {
            position: "absolute",
            width: 5,
            height: 5,
            borderRadius: 5,
        },
        core: {
            width: core,
            height: core,
            borderRadius: core,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.colors.primary,
            shadowOpacity: 0.55,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
        },
        sweep: {
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
        },
        label: {
            color: t.colors.textPrimary,
            fontWeight: "900",
            fontSize: 16,
            marginTop: 14,
        },
        sublabel: {
            color: t.colors.textMuted,
            fontWeight: "600",
            fontSize: 12.5,
            marginTop: 4,
        },
    });
