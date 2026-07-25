import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import GradientScreen from "../ui/GradientScreen";
import { AppColors } from "../ui/tokens";

export default function BootScreen() {
    return (
        <GradientScreen>
            <View style={styles.container}>
                <Text style={styles.logo}>PaperAI</Text>
                <Text style={styles.tagline}>Your AI document assistant</Text>
                <ActivityIndicator
                    size="large"
                    color={AppColors.primary}
                    style={{ marginTop: 24 }}
                />
            </View>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    logo: {
        fontSize: 34,
        fontWeight: "800",
        color: AppColors.textPrimary,
    },
    tagline: {
        marginTop: 6,
        color: AppColors.textMuted,
        fontWeight: "600",
    },
});
