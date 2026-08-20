import React from "react";
import { View, StyleSheet } from "react-native";
import GradientScreen from "../ui/GradientScreen";
import BrandLockup from "../ui/BrandLockup";

import useThemedStyles from "../ui/useThemedStyles";

/**
 * BootScreen — shown while the session is restored. Uses the same BrandLockup as
 * Login so the first frame of the app is already on-brand: the orb spins in
 * "working" state, which doubles as the loading indicator (no spinner needed).
 */
export default function BootScreen() {
    const styles = useThemedStyles(makeStyles);
    return (
        <GradientScreen>
            <View style={styles.container}>
                <BrandLockup size="lg" state="working" pillars={false} tagline="Getting your workspace ready…" />
            </View>
        </GradientScreen>
    );
}

const makeStyles = () =>
    StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
    });
