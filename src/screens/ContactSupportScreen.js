import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Linking, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
// Central support contact details.
const SUPPORT_PHONE = "+1 833 374-3700";
const SUPPORT_EMAIL = "info@bholeshankarenterprisesprivatelimited.com";
const SUPPORT_URL = "https://bseptechnologies.com/paper-ai/support";
const MANAGE_SUBSCRIPTION_URL = "https://apps.apple.com/account/subscriptions";

async function openLink(url) {
    try {
        const ok = await Linking.canOpenURL(url);
        if (ok) await Linking.openURL(url);
        else Alert.alert("Unavailable", "Could not open this link on your device.");
    } catch {
        Alert.alert("Unavailable", "Could not open this link on your device.");
    }
}

export default function ContactSupportScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [message, setMessage] = useState("");

    function submit() {
        const body = encodeURIComponent(message || "");
        const subject = encodeURIComponent("PaperAI Support Request");
        openLink(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Contact Support</Text>
                    <Text style={styles.subtitle}>
                        We're here to help. Reach us through any option below — we typically
                        reply within one business day.
                    </Text>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(`tel:${SUPPORT_PHONE.replace(/[^+\d]/g, "")}`)}>
                        <View style={styles.icon}><Ionicons name="call-outline" size={22} color={theme.colors.accentText} /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Call us</Text>
                            <Text style={styles.rowValue}>{SUPPORT_PHONE}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.placeholder} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)}>
                        <View style={styles.icon}><Ionicons name="mail-outline" size={22} color={theme.colors.accentText} /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Email us</Text>
                            <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.placeholder} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(SUPPORT_URL)}>
                        <View style={styles.icon}><Ionicons name="globe-outline" size={22} color={theme.colors.accentText} /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Help & support site</Text>
                            <Text style={styles.rowValue}>{SUPPORT_URL}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.placeholder} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(MANAGE_SUBSCRIPTION_URL)}>
                        <View style={styles.icon}><Ionicons name="card-outline" size={22} color={theme.colors.accentText} /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Manage subscription</Text>
                            <Text style={styles.rowValue}>App Store › Subscriptions</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.placeholder} />
                    </TouchableOpacity>

                    <Text style={styles.formLabel}>Send us a message</Text>
                    <TextInput
                        placeholder="Describe your issue"
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        style={styles.input} keyboardAppearance={theme.keyboardAppearance} />

                    <AppButton title="Submit Enquiry" onPress={submit} />
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 18, gap: 14 },
    title: { color: t.colors.textPrimary, fontSize: 24, fontWeight: "900" },
    subtitle: { color: t.colors.textMuted, fontWeight: "700", lineHeight: 20 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 16,
        padding: 14,
    },
    icon: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: t.colors.infoBg,
    },
    rowText: { flex: 1 },
    rowTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 15 },
    rowValue: { color: t.colors.accentText, fontWeight: "700", fontSize: 13, marginTop: 2 },

    formLabel: { color: t.colors.textMuted, fontWeight: "700", marginTop: 6 },
    input: {
        minHeight: 120,
        backgroundColor: t.colors.inputBg,
        borderWidth: 1,
        borderColor: t.colors.inputBorder,
        borderRadius: 14,
        padding: 14,
        color: t.colors.textPrimary,
        fontWeight: "500",
        textAlignVertical: "top",
    },
});
