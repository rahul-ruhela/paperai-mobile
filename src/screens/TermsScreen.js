import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

const LAST_UPDATED = "June 30, 2026";

function Section({ heading, children }) {
    return (
        <View style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.text}>{children}</Text>
        </View>
    );
}

export default function TermsScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Terms of Service</Text>
                    <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

                    <Section heading="1. Acceptance of Terms">
                        By downloading, accessing, or using Paper AI Assistant ("PaperAI", the
                        "app", "we", "us"), you agree to be bound by these Terms of Service. If you
                        do not agree, please do not use the app.
                    </Section>

                    <Section heading="2. The Service">
                        PaperAI provides AI-assisted document scanning, text extraction, and
                        analysis. AI output may contain errors and should not be relied upon as
                        professional, legal, financial, or medical advice. You are responsible for
                        reviewing all results before acting on them.
                    </Section>

                    <Section heading="3. Acceptable Use">
                        You agree to use PaperAI lawfully and not to: upload content you do not have
                        the right to use; attempt to reverse-engineer, disrupt, or overload the
                        service; or misuse AI-generated content. We may suspend accounts that
                        violate these terms.
                    </Section>

                    <Section heading="4. Subscriptions & Credits">
                        PaperAI offers auto-renewable subscriptions that grant in-app credits used
                        to process documents. Payment is charged to your Apple ID at confirmation of
                        purchase. Subscriptions renew automatically unless cancelled at least 24
                        hours before the end of the current period. Manage or cancel anytime in App
                        Store › Account › Subscriptions. Credits are consumed as you use paid
                        features and are non-transferable.
                    </Section>

                    <Section heading="5. Refunds, Disputes & Chargebacks">
                        All purchases are processed by Apple. Refund requests for App Store purchases
                        are handled solely by Apple under its standard policy
                        (reportaproblem.apple.com); we cannot issue Apple refunds directly. Because
                        credits are a digital good that is delivered and consumed immediately, you
                        agree that credits already used are non-refundable. You further agree not to
                        initiate a chargeback, payment dispute, or reversal for services or credits
                        that have already been delivered or consumed. Initiating a chargeback for
                        consumed services may be treated as a breach of these Terms and may result
                        in immediate suspension or termination of your account and forfeiture of any
                        remaining credits. If you believe a charge is in error, contact us first at
                        info@bholeshankarenterprisesprivatelimited.com and we will work with you in
                        good faith.
                    </Section>

                    <Section heading="6. Intellectual Property">
                        You retain ownership of the documents and content you upload. You grant us a
                        limited license to process that content solely to provide the service. The
                        app, its software, and branding remain our property.
                    </Section>

                    <Section heading="7. Disclaimers & Limitation of Liability">
                        The service is provided "as is" without warranties of any kind. To the
                        maximum extent permitted by law, we are not liable for any indirect,
                        incidental, or consequential damages arising from your use of the app.
                    </Section>

                    <Section heading="8. Changes to These Terms">
                        We may update these Terms from time to time. Continued use of the app after
                        changes take effect constitutes acceptance of the revised Terms.
                    </Section>

                    <Section heading="9. Contact">
                        Questions about these Terms? Email
                        info@bholeshankarenterprisesprivatelimited.com.
                    </Section>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, paddingBottom: 40 },
    title: { color: "#111111", fontSize: 24, fontWeight: "900" },
    updated: { color: "#9CA3AF", fontWeight: "700", fontSize: 12, marginTop: 4, marginBottom: 8 },
    section: { marginTop: 16 },
    heading: { color: "#2563EB", fontWeight: "900", fontSize: 15, marginBottom: 6 },
    text: { color: "#374151", lineHeight: 22, fontWeight: "600" },
});
