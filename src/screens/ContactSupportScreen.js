import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Linking, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";

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
                        <View style={styles.icon}><Ionicons name="call-outline" size={22} color="#2563EB" /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Call us</Text>
                            <Text style={styles.rowValue}>{SUPPORT_PHONE}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)}>
                        <View style={styles.icon}><Ionicons name="mail-outline" size={22} color="#2563EB" /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Email us</Text>
                            <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(SUPPORT_URL)}>
                        <View style={styles.icon}><Ionicons name="globe-outline" size={22} color="#2563EB" /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Help & support site</Text>
                            <Text style={styles.rowValue}>{SUPPORT_URL}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.row} onPress={() => openLink(MANAGE_SUBSCRIPTION_URL)}>
                        <View style={styles.icon}><Ionicons name="card-outline" size={22} color="#2563EB" /></View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>Manage subscription</Text>
                            <Text style={styles.rowValue}>App Store › Subscriptions</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>

                    <Text style={styles.formLabel}>Send us a message</Text>
                    <TextInput
                        placeholder="Describe your issue"
                        placeholderTextColor="#6B7280"
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        style={styles.input}
                    />

                    <AppButton title="Submit Enquiry" onPress={submit} />
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 14 },
    title: { color: "#111111", fontSize: 24, fontWeight: "900" },
    subtitle: { color: "#6B7280", fontWeight: "700", lineHeight: 20 },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 16,
        padding: 14,
    },
    icon: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(79,140,255,0.12)",
    },
    rowText: { flex: 1 },
    rowTitle: { color: "#111111", fontWeight: "900", fontSize: 15 },
    rowValue: { color: "#2563EB", fontWeight: "700", fontSize: 13, marginTop: 2 },

    formLabel: { color: "#6B7280", fontWeight: "700", marginTop: 6 },
    input: {
        minHeight: 120,
        backgroundColor: "rgba(255,255,255,0.82)",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 14,
        padding: 14,
        color: "#111111",
        fontWeight: "500",
        textAlignVertical: "top",
    },
});
