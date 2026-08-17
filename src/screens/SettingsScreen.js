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

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
export default function SettingsScreen({ navigation, onLoggedOut }) {
    const { theme, preference, setPreference } = useTheme();
    const styles = useThemedStyles(makeStyles);
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
                <View style={[styles.rowIcon, danger && { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.dangerBorder }]}>
                    <Ionicons
                        name={icon}
                        size={18}
                        color={danger ? theme.colors.dangerText : theme.colors.accentText}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, danger && { color: theme.colors.dangerText }]}>{title}</Text>
                    {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
        );
    }

    function AppearanceOption({ value, label, icon, hint }) {
        const selected = preference === value;
        return (
            <Pressable
                onPress={() => setPreference(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label}. ${hint}`}
                style={({ pressed }) => [
                    styles.appearanceOption,
                    selected && styles.appearanceOptionActive,
                    pressed && { opacity: 0.8 },
                ]}
            >
                <Ionicons
                    name={icon}
                    size={20}
                    color={selected ? theme.colors.accentText : theme.colors.textMuted}
                />
                <Text style={[styles.appearanceLabel, selected && styles.appearanceLabelActive]}>
                    {label}
                </Text>
                {/* Selection is shown by a check as well as colour, so it does
                    not rely on colour alone. */}
                {selected ? (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.accentText} />
                ) : null}
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
                            title="Privacy Policy"
                            subtitle="How we handle your documents"
                            onPress={() => navigation.navigate("Privacy")}
                        />

                        <Row
                            icon="document-text-outline"
                            title="Terms of Use (EULA)"
                            subtitle="User agreement and subscription terms"
                            onPress={() => navigation.navigate("Terms")}
                        />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Appearance</Text>
                        <Text style={styles.sectionHint}>
                            Choose how PaperAI looks. “System” follows your{" "}
                            {Platform.OS === "ios" ? "iOS" : "device"} Display setting.
                        </Text>

                        <View style={styles.appearanceRow} accessibilityRole="radiogroup">
                            <AppearanceOption
                                value="system"
                                label="System"
                                icon="phone-portrait-outline"
                                hint="Follow the device appearance setting"
                            />
                            <AppearanceOption
                                value="light"
                                label="Light"
                                icon="sunny-outline"
                                hint="Always use the light theme"
                            />
                            <AppearanceOption
                                value="dark"
                                label="Dark"
                                icon="moon-outline"
                                hint="Always use the dark theme"
                            />
                        </View>
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

const makeStyles = (t) =>
    StyleSheet.create({

    container: {
        padding: 18,
        paddingBottom: 60, // ✅ ensures logout is visible
        gap: 16,
    },
    title: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },

    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 20,
        padding: 14,
        gap: 6,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    section: { color: t.colors.textMuted, fontSize: 15, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
    sectionHint: {
        color: t.colors.textMuted,
        fontSize: 12,
        fontWeight: "500",
        lineHeight: 17,
        marginBottom: 10,
    },

    appearanceRow: { flexDirection: "row", gap: 8 },
    appearanceOption: {
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.glassSoft,
    },
    appearanceOptionActive: {
        borderColor: t.colors.primary,
        backgroundColor: t.colors.infoBg,
    },
    appearanceLabel: {
        color: t.colors.textSecondary,
        fontSize: 12,
        fontWeight: "700",
    },
    appearanceLabelActive: { color: t.colors.accentText },

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
        backgroundColor: t.colors.infoBg,
        borderWidth: 1,
        borderColor: t.colors.infoBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    rowTitle: { color: t.colors.textPrimary, fontWeight: "700" },
    rowSub: { marginTop: 2, color: t.colors.textMuted, fontWeight: "500", fontSize: 12 },

    footer: { marginTop: "auto", textAlign: "center", color: t.colors.textMuted, fontWeight: "600" },
});
