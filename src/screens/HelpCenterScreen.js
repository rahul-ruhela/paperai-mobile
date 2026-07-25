import React, { useState } from "react";
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";

const FAQS = [
    {
        q: "How do I scan a document?",
        a: "Open Upload, then choose Camera to scan a page or Photo Library to pick an existing image. PaperAI extracts the text and runs AI analysis automatically.",
    },
    {
        q: "What file types are supported?",
        a: "Photos (JPG/PNG) captured or selected from your library, and PDFs via the document picker. Very large files may take longer or fail on slow connections.",
    },
    {
        q: "Why is my document still pending?",
        a: "AI analysis usually takes a few seconds. If it stays pending, check your internet connection and tap the document to retry.",
    },
    {
        q: "How do credits work?",
        a: "Each paid feature costs a set number of credits, shown before you run it. Credits are reserved when an operation starts and finalized when it completes; if an operation fails, the reserved credits are refunded automatically.",
    },
    {
        q: "Why did my credits go down?",
        a: "Credits are consumed when you run AI features such as analysis or extraction. The amount depends on the feature and document size. See Credit Analytics for a breakdown.",
    },
    {
        q: "How do I get more credits?",
        a: "Subscribe to a plan (Essential, Plus, or Advance) from the Paywall. Each plan grants credits per billing cycle.",
    },
    {
        q: "How do I subscribe or change my plan?",
        a: "Open the Paywall, pick a duration (Weekly/Monthly/Yearly) and a tier, then tap Subscribe. To upgrade, downgrade, or cancel later, go to App Store › Account › Subscriptions.",
    },
    {
        q: "I subscribed but don't see my credits.",
        a: "Tap Restore Purchases on the Paywall. If credits still don't appear, make sure you're signed into the same Apple ID used to purchase, then contact support.",
    },
    {
        q: "How do I restore a purchase on a new device?",
        a: "Sign in with the same account, open the Paywall, and tap Restore Purchases. Your active subscription and entitlement will be restored.",
    },
    {
        q: "How do I cancel my subscription?",
        a: "Cancellation is handled by Apple: App Store › tap your photo › Subscriptions › PaperAI › Cancel. Access continues until the end of the current billing period.",
    },
    {
        q: "Can I get a refund?",
        a: "App Store refunds are handled by Apple at reportaproblem.apple.com. Note that credits already used are non-refundable. Contact us first and we'll help where we can.",
    },
    {
        q: "Why did my upload fail?",
        a: "Usually a connectivity issue or an unsupported/oversized file. Check your internet, reduce file size, and try again.",
    },
    {
        q: "Is my data private?",
        a: "Your documents are sent over encrypted connections, processed for your account only, and never sold. See the Privacy Policy for full details.",
    },
    {
        q: "How do I delete my account or data?",
        a: "Go to Settings › Delete Account to permanently delete your account and personal data directly in the app. You can also email info@bholeshankarenterprisesprivatelimited.com if you need help.",
    },
];

const LINKS = [
    { icon: "card-outline", label: "Manage subscription", url: "https://apps.apple.com/account/subscriptions" },
    { icon: "refresh-outline", label: "Request an Apple refund", url: "https://reportaproblem.apple.com" },
    { icon: "shield-checkmark-outline", label: "Privacy Policy", url: "https://bseptechnologies.com/paper-ai/privacy" },
    { icon: "globe-outline", label: "Support website", url: "https://bseptechnologies.com/paper-ai/support" },
    { icon: "mail-outline", label: "Email support", url: "mailto:info@bholeshankarenterprisesprivatelimited.com" },
];

async function openLink(url) {
    try {
        const ok = await Linking.canOpenURL(url);
        if (ok) await Linking.openURL(url);
        else Alert.alert("Unavailable", "Could not open this link on your device.");
    } catch {
        Alert.alert("Unavailable", "Could not open this link on your device.");
    }
}

function FAQ({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setOpen((v) => !v)}>
            <View style={styles.qRow}>
                <Text style={styles.q}>{q}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#2563EB" />
            </View>
            {open && <Text style={styles.a}>{a}</Text>}
        </TouchableOpacity>
    );
}

export default function HelpCenterScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Help Center</Text>
                    <Text style={styles.subtitle}>Tap a question to expand the answer.</Text>

                    {FAQS.map((f) => (
                        <FAQ key={f.q} q={f.q} a={f.a} />
                    ))}

                    <Text style={styles.sectionTitle}>Quick links</Text>
                    {LINKS.map((l) => (
                        <TouchableOpacity key={l.label} style={styles.linkRow} onPress={() => openLink(l.url)}>
                            <Ionicons name={l.icon} size={20} color="#2563EB" />
                            <Text style={styles.linkText}>{l.label}</Text>
                            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 12, paddingBottom: 40 },
    title: { color: "#111111", fontSize: 24, fontWeight: "900" },
    subtitle: { color: "#6B7280", fontWeight: "700", marginBottom: 4 },
    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        padding: 14,
        borderRadius: 16,
    },
    qRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    q: { color: "#111111", fontWeight: "900", flex: 1 },
    a: { marginTop: 8, color: "#374151", fontWeight: "600", lineHeight: 20 },

    sectionTitle: { color: "#111111", fontSize: 18, fontWeight: "900", marginTop: 18 },
    linkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 16,
        padding: 14,
    },
    linkText: { color: "#111111", fontWeight: "800", flex: 1 },
});
