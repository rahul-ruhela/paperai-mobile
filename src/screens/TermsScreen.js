import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function TermsScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Terms of Service</Text>

                    <Text style={styles.h}>Service</Text>
                    <Text style={styles.text}>
                        PaperAI provides tools to upload documents, process content, and generate outputs. You agree to use
                        the service lawfully and responsibly.
                    </Text>

                    <Text style={styles.h}>Subscriptions (Auto-Renewable)</Text>
                    <Text style={styles.text}>
                        If you purchase a subscription, payment will be charged to your Apple ID at confirmation of purchase.
                        Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
                        Your Apple ID account will be charged for renewal within 24 hours prior to the end of the current period.
                        You can manage or cancel your subscription in Settings → Apple ID → Subscriptions.
                    </Text>

                    <Text style={styles.h}>Free Trials / Intro Offers</Text>
                    <Text style={styles.text}>
                        If a free trial or introductory offer is available, any unused portion may be forfeited when you purchase
                        a subscription, where applicable under Apple’s rules.
                    </Text>

                    <Text style={styles.h}>Acceptable Use</Text>
                    <Text style={styles.text}>
                        Do not upload illegal content or content that infringes rights. Do not attempt to disrupt the service,
                        reverse engineer protected components, or misuse outputs for unlawful purposes.
                    </Text>

                    <Text style={styles.h}>Disclaimer</Text>
                    <Text style={styles.text}>
                        Outputs may contain errors. You are responsible for verifying results before using them for legal, financial,
                        medical, or other high-stakes decisions.
                    </Text>

                    <Text style={styles.h}>Support</Text>
                    <Text style={styles.text}>
                        Questions or support requests: support@paperai.app
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18 },
    title: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 12 },
    h: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 14, marginBottom: 6 },
    text: { color: "rgba(255,255,255,0.82)", lineHeight: 22, fontWeight: "700" },
});
