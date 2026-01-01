import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import GradientScreen from "../ui/GradientScreen";

export default function BootScreen() {
    return (
        <GradientScreen>
            <View style={styles.container}>
                <Text style={styles.logo}>PaperAI</Text>
                <Text style={styles.tagline}>Your AI document assistant</Text>
                <ActivityIndicator
                    size="large"
                    color="#A5B4FC"
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
        fontWeight: "900",
        color: "#fff",
    },
    tagline: {
        marginTop: 6,
        color: "rgba(255,255,255,0.7)",
        fontWeight: "600",
    },
});
