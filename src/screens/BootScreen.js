import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import GradientScreen from "../ui/GradientScreen";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
export default function BootScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <GradientScreen>
            <View style={styles.container}>
                <Text style={styles.logo}>PaperAI</Text>
                <Text style={styles.tagline}>Your AI document assistant</Text>
                <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                    style={{ marginTop: 24 }}
                />
            </View>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    logo: {
        fontSize: 34,
        fontWeight: "800",
        color: t.colors.textPrimary,
    },
    tagline: {
        marginTop: 6,
        color: t.colors.textMuted,
        fontWeight: "600",
    },
});
