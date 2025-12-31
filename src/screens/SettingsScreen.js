import React from "react";
import { View, Text, Alert, StyleSheet, Pressable, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import { logout } from "../api/auth";

export default function SettingsScreen({ navigation, onLoggedOut }) {
    async function onLogout() {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    try {
                        await logout();
                        onLoggedOut?.(); // ✅ this flips authed=false in App.js
                    } catch (e) {
                        Alert.alert("Logout failed", e.message);
                    }
                },
            },
        ]);
    }

    function Row({ icon, title, subtitle, onPress, danger }) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
                <View style={[styles.rowIcon, danger && { backgroundColor: "rgba(239,68,68,0.16)", borderColor: "rgba(239,68,68,0.25)" }]}>
                    <Ionicons name={icon} size={18} color={danger ? "#FCA5A5" : "#E0E7FF"} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, danger && { color: "#FCA5A5" }]}>{title}</Text>
                    {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.55)" />
            </Pressable>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                >

               {/* <View style={styles.container}>*/}
                    <Text style={styles.title}>Settings</Text>

                    <View style={styles.card}>
                        <Text style={styles.section}>Account</Text>

                        <Row
                            icon="person-outline"
                            title="Profile"
                            subtitle="Update name, email, phone"
                            onPress={() => navigation.navigate("Profile")}
                        />

                        <Row
                            icon="bar-chart-outline"
                            title="Credit Analytics"
                            subtitle="View usage insights"
                            onPress={() => navigation.navigate("Analytics")}
                        />

                        <Row
                            icon="logo-apple"
                            title="Apple IAP Setup"
                            subtitle="TestFlight readiness checklist"
                            onPress={() => navigation.navigate("IAPSetup")}
                        />

                        <Row
                            icon="shield-checkmark-outline"
                            title="Privacy"
                            subtitle="How we handle your documents"
                            onPress={() => navigation.navigate("Privacy")}
                        />

                        <Row
                            icon="document-text-outline"
                            title="Terms"
                            subtitle="User agreement"
                            onPress={() => navigation.navigate("Terms")}
                        />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Support</Text>

                        <Row
                            icon="help-circle-outline"
                            title="Help Center"
                            subtitle="FAQs and troubleshooting"
                            onPress={() => navigation.navigate("HelpCenter")}
                        />

                        <Row
                            icon="mail-outline"
                            title="Contact Support"
                            subtitle="Email us for help"
                            onPress={() => navigation.navigate("ContactSupport")}
                        />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Session</Text>

                        <Row
                            icon="log-out-outline"
                            title="Log out"
                            subtitle="You’ll return to login"
                            onPress={onLogout}
                            danger
                        />
                    </View>

                    <Text style={styles.footer}>
                        PaperAI • v1.0
                    </Text>

                 
                   </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({

    container: {
        padding: 18,
        paddingBottom: 60, // ✅ ensures logout is visible
        gap: 16,
    },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 14,
        gap: 6,
    },
    section: { color: "rgba(255,255,255,0.65)", fontSize: 19, fontWeight: "900", marginBottom: 6 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderRadius: 16,
    },
    rowIcon: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: "rgba(99,102,241,0.16)",
        borderWidth: 1,
        borderColor: "rgba(165,180,252,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    rowTitle: { color: "#fff", fontWeight: "900" },
    rowSub: { marginTop: 2, color: "rgba(255,255,255,0.62)", fontWeight: "700", fontSize: 12 },

    footer: { marginTop: "auto", textAlign: "center", color: "rgba(255,255,255,0.45)", fontWeight: "700" },
});
