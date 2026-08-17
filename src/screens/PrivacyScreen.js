import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
const LAST_UPDATED = "June 30, 2026";

function Section({ heading, children }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.text}>{children}</Text>
        </View>
    );
}

export default function PrivacyScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Privacy Policy</Text>
                    <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

                    <Text style={styles.intro}>
                        This policy explains what Paper AI Assistant ("PaperAI", "we") collects,
                        why, and the choices you have. We designed the app to collect the minimum
                        data needed to work, and we never sell your personal information.
                    </Text>

                    <Section heading="1. Information We Collect">
                        • Account data: email address and authentication identifiers you provide
                        when you register or sign in (including Sign in with Apple).{"\n"}
                        • Content you submit: documents, images, and text you upload for scanning and
                        AI analysis.{"\n"}
                        • Usage & device data: app interactions, credit usage, crash logs, device
                        type and OS version, used to operate and improve the service.{"\n"}
                        • Purchase data: subscription status and transaction identifiers from Apple.
                        We never receive or store your full payment card details.
                    </Section>

                    <Section heading="2. How We Use Your Information">
                        We use your information to: provide document scanning and AI analysis;
                        manage your account, subscriptions, and credit balance; provide customer
                        support; maintain security and prevent abuse; and comply with legal
                        obligations. We do not use your uploaded documents to train third-party AI
                        models.
                    </Section>

                    <Section heading="3. How Your Content Is Processed">
                        Documents are transmitted over encrypted connections (HTTPS/TLS) and
                        processed to return your results. Processing is scoped to your account.
                        We retain content only as long as needed to provide the service and your
                        history, after which it can be deleted on request.
                    </Section>

                    <Section heading="4. Sharing & Disclosure">
                        We do not sell your personal data. We share data only with: Apple (for
                        in-app purchases and authentication); infrastructure and AI processing
                        providers acting on our behalf under confidentiality obligations; and
                        authorities where required by law. These providers may process data only to
                        perform services for us.
                    </Section>

                    <Section heading="5. Data Retention">
                        We keep account and transaction records for as long as your account is
                        active and as required for legal, tax, and accounting purposes. You may
                        request deletion of your account and associated content at any time.
                    </Section>

                    <Section heading="6. Your Rights">
                        Depending on your location (including under GDPR and CCPA), you may have the
                        right to access, correct, export, or delete your personal data, and to
                        object to or restrict certain processing. To exercise these rights, email
                        info@bholeshankarenterprisesprivatelimited.com and we will respond within
                        the timeframes required by applicable law.
                    </Section>

                    <Section heading="7. Security">
                        We use encryption in transit, access controls, and other safeguards to
                        protect your data. No method of transmission or storage is 100% secure, but
                        we work to protect your information and promptly address vulnerabilities.
                    </Section>

                    <Section heading="8. Children's Privacy">
                        PaperAI is not directed to children under 13 (or the minimum age in your
                        jurisdiction). We do not knowingly collect data from children. If you
                        believe a child has provided us data, contact us and we will delete it.
                    </Section>

                    <Section heading="9. International Transfers">
                        Your information may be processed in countries other than your own. Where
                        required, we use appropriate safeguards for such transfers.
                    </Section>

                    <Section heading="10. Changes to This Policy">
                        We may update this policy and will revise the "Last updated" date above.
                        Material changes will be communicated in-app where appropriate.
                    </Section>

                    <Section heading="11. Contact Us">
                        Questions or requests? Email
                        info@bholeshankarenterprisesprivatelimited.com or visit
                        https://bseptechnologies.com/paper-ai/privacy.
                    </Section>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 18, paddingBottom: 40 },
    title: { color: t.colors.textPrimary, fontSize: 24, fontWeight: "900" },
    updated: { color: t.colors.placeholder, fontWeight: "700", fontSize: 12, marginTop: 4, marginBottom: 12 },
    intro: { color: t.colors.textSecondary, lineHeight: 22, fontWeight: "600" },
    section: { marginTop: 16 },
    heading: { color: t.colors.accentText, fontWeight: "900", fontSize: 15, marginBottom: 6 },
    text: { color: t.colors.textSecondary, lineHeight: 22, fontWeight: "600" },
});
