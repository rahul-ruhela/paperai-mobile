import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated, Easing, StyleSheet } from "react-native";
import GradientScreen from "../ui/GradientScreen";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import useReduceMotion from "../ui/useReduceMotion";

/**
 * BootScreen — what the app shows while it decides whether you are signed in.
 *
 * Uses the real app icon rather than a spinner over a wordmark, so the launch
 * image and the first frame of the app are the same object: the icon the user
 * just tapped stays on screen instead of being replaced by unrelated chrome.
 *
 * The pulse is a breathing scale on the icon, with a progress track underneath.
 * Under "Reduce Motion" the icon simply sits still — the track stays, so there
 * is still a sign the app is doing something.
 */
export default function BootScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const reduceMotion = useReduceMotion();

    const pulse = useRef(new Animated.Value(0)).current;
    const sweep = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) return undefined;

        const breathe = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        const slide = Animated.loop(
            Animated.timing(sweep, {
                toValue: 1,
                duration: 1200,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
            })
        );
        breathe.start();
        slide.start();
        return () => {
            breathe.stop();
            slide.stop();
        };
    }, [reduceMotion, pulse, sweep]);

    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
    const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
    const slideX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });

    return (
        <GradientScreen>
            <View style={styles.container} accessible accessibilityLabel="Paper AI Assistant is starting">
                <View style={styles.iconWrap}>
                    {!reduceMotion && (
                        <Animated.View style={[styles.halo, { opacity: glow, transform: [{ scale }] }]} />
                    )}
                    <Animated.Image
                        source={require("../../assets/icon.png")}
                        style={[styles.icon, { transform: reduceMotion ? [] : [{ scale }] }]}
                        resizeMode="contain"
                    />
                </View>

                <Text style={styles.logo}>Paper AI</Text>
                <Text style={styles.tagline}>Your AI document assistant</Text>

                {/* An indeterminate track rather than a spinner: it reads as
                    "loading" without competing with the icon for attention. */}
                <View style={styles.track}>
                    <Animated.View
                        style={[
                            styles.trackFill,
                            reduceMotion ? { width: "40%" } : { transform: [{ translateX: slideX }] },
                        ]}
                    />
                </View>
            </View>
        </GradientScreen>
    );
}

const ICON = 96;

const makeStyles = (t) =>
    StyleSheet.create({
        container: { flex: 1, justifyContent: "center", alignItems: "center" },

        iconWrap: {
            width: ICON + 28,
            height: ICON + 28,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
        },
        halo: {
            position: "absolute",
            width: ICON + 26,
            height: ICON + 26,
            borderRadius: (ICON + 26) / 2,
            backgroundColor: t.colors.infoBg,
        },
        icon: {
            width: ICON,
            height: ICON,
            borderRadius: 22,
        },

        logo: { fontSize: 30, fontWeight: "900", color: t.colors.textPrimary, letterSpacing: -0.5 },
        tagline: { marginTop: 6, color: t.colors.textMuted, fontWeight: "600" },

        track: {
            marginTop: 26,
            width: 120,
            height: 4,
            borderRadius: 2,
            backgroundColor: t.colors.border,
            overflow: "hidden",
        },
        trackFill: {
            width: "45%",
            height: 4,
            borderRadius: 2,
            backgroundColor: t.colors.primary,
        },
    });
