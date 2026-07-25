import React from "react";

import {
    View,
    Text,
    Alert,
    StyleSheet,
    Pressable,
    ScrollView,
    Linking,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import { logout, deleteAccount } from "../api/auth";

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

    function onDeleteAccount() {
        Alert.alert(
            "Delete account?",
            "This permanently deletes your account, documents, and personal data. Remaining credits are lost. Active subscriptions must be cancelled separately in App Store › Subscriptions.\n\nThis cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        // Second confirmation — deletion is irreversible.
                        Alert.alert(
                            "Are you absolutely sure?",
                            "Your account and data will be permanently deleted.",
                            [
                                { text: "Keep my account", style: "cancel" },
                                {
                                    text: "Delete permanently",
                                    style: "destructive",
                                    onPress: async () => {
                                        try {
                                            await deleteAccount();
                                            Alert.alert("Account deleted", "Your account and data have been removed.");
                                            onLoggedOut?.();
                                        } catch (e) {
                                            Alert.alert(
                                                "Deletion failed",
                                                e?.userMessage ?? e?.message ?? "Please try again or contact support."
                                            );
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    }

    function Row({ icon, title, subtitle, onPress, danger }) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
                <View style={[styles.rowIcon, danger && { backgroundColor: "rgba(255,90,95,0.12)", borderColor: "rgba(255,90,95,0.30)" }]}>
                    <Ionicons name={icon} size={18} color={danger ? "#DC2626" : "#2563EB"} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, danger && { color: "#DC2626" }]}>{title}</Text>
                    {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </Pressable>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={90}
                >
                    <ScrollView
                        contentContainerStyle={styles.container}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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
                            icon="star-outline"
                            title="Upgrade to AI Pro"
                            subtitle="Unlock unlimited AI features"
                            onPress={() => navigation.navigate("Paywall")}
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

                        <Row
                            icon="trash-outline"
                            title="Delete Account"
                            subtitle="Permanently delete your account and data"
                            onPress={onDeleteAccount}
                            danger
                        />
                    </View>

                    <Text style={styles.footer}>
                        PaperAI • v1.0
                    </Text>

                 
                    </ScrollView>
                </KeyboardAvoidingView>
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
    title: { color: "#111111", fontSize: 26, fontWeight: "800" },

    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 20,
        padding: 14,
        gap: 6,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    section: { color: "#6B7280", fontSize: 15, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        minHeight: 44,
        borderRadius: 16,
    },
    rowIcon: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: "rgba(79,140,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(79,140,255,0.20)",
        alignItems: "center",
        justifyContent: "center",
    },
    rowTitle: { color: "#111111", fontWeight: "700" },
    rowSub: { marginTop: 2, color: "#6B7280", fontWeight: "500", fontSize: 12 },

    footer: { marginTop: "auto", textAlign: "center", color: "#6B7280", fontWeight: "600" },
});
