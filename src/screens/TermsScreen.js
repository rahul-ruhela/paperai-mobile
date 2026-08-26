import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
const LAST_UPDATED = "August 18, 2026";

function Section({ heading, children }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.text}>{children}</Text>
        </View>
    );
}

export default function TermsScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Terms of Use (EULA)</Text>
                    <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>

                    <Text style={styles.intro}>
                        This End User License Agreement ("Agreement") is a binding agreement
                        between you and Bhole Shankar Enterprises Private Limited governing your
                        use of Paper AI Assistant. Please read it carefully. A copy is also
                        available at bseptechnologies.com/paper-ai/terms.
                    </Text>

                    <Section heading="1. Acceptance of Terms">
                        By downloading, accessing, or using Paper AI Assistant ("PaperAI", the
                        "app", "we", "us"), you agree to be bound by these Terms of Use. If you
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
                        hours before the end of the current period, and your account is charged for
                        renewal within 24 hours prior to the end of the current period. Manage or
                        cancel anytime in App Store › Account › Subscriptions. Each billing period your
                        balance is reset to the credit allowance of your plan — credits do not roll
                        over, and any unused credits are lost at the end of the period rather than
                        added to the next one. Changing plans does not carry a balance across.
                        Credits are consumed as you use paid features and are non-transferable. Some
                        paid features — such
                        as a duplicate scan — consume credits each time they run, including when the
                        scan completes successfully and finds nothing to remove; the scan itself is
                        the service being provided.
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

                    {/* Sections 8–15 are Apple's minimum required EULA terms. They must
                        remain present and substantially unchanged whenever a custom EULA is
                        used in place of Apple's standard one. */}
                    <Section heading="8. This Agreement Is With Us, Not Apple">
                        You acknowledge that this Agreement is concluded between you and Bhole
                        Shankar Enterprises Private Limited only, and not with Apple Inc. We, not
                        Apple, are solely responsible for Paper AI Assistant and its content.
                    </Section>

                    <Section heading="9. Scope of Licence">
                        We grant you a non-transferable licence to use Paper AI Assistant on any
                        Apple-branded products that you own or control, as permitted by the Usage
                        Rules set out in the Apple Media Services Terms and Conditions, except that
                        the app may be accessed and used by other accounts associated with you via
                        Family Sharing or volume purchasing.
                    </Section>

                    <Section heading="10. Maintenance and Support">
                        We are solely responsible for providing any maintenance and support services
                        for Paper AI Assistant, as specified in this Agreement or as required under
                        applicable law. You acknowledge that Apple has no obligation whatsoever to
                        furnish any maintenance and support services for the app.
                    </Section>

                    <Section heading="11. Warranty">
                        We are solely responsible for any product warranties, whether express or
                        implied by law, to the extent not effectively disclaimed. In the event of any
                        failure of Paper AI Assistant to conform to any applicable warranty, you may
                        notify Apple, and Apple will refund the purchase price (if any) for the app
                        to you. To the maximum extent permitted by applicable law, Apple will have no
                        other warranty obligation whatsoever with respect to the app, and any other
                        claims, losses, liabilities, damages, costs or expenses attributable to any
                        failure to conform to any warranty will be our sole responsibility.
                    </Section>

                    <Section heading="12. Product Claims">
                        We, not Apple, are responsible for addressing any claims by you or any third
                        party relating to Paper AI Assistant or your possession and use of it,
                        including but not limited to: (i) product liability claims; (ii) any claim
                        that the app fails to conform to any applicable legal or regulatory
                        requirement; and (iii) claims arising under consumer protection, privacy, or
                        similar legislation.
                    </Section>

                    <Section heading="13. Intellectual Property Claims">
                        In the event of any third-party claim that Paper AI Assistant or your
                        possession and use of it infringes that third party's intellectual property
                        rights, we, not Apple, will be solely responsible for the investigation,
                        defence, settlement and discharge of any such claim.
                    </Section>

                    <Section heading="14. Legal Compliance">
                        You represent and warrant that you are not located in a country that is
                        subject to a U.S. Government embargo, or that has been designated by the U.S.
                        Government as a "terrorist supporting" country; and that you are not listed
                        on any U.S. Government list of prohibited or restricted parties. You also
                        agree to comply with any applicable third-party terms of agreement when using
                        the app.
                    </Section>

                    <Section heading="15. Third Party Beneficiary">
                        You acknowledge and agree that Apple, and Apple's subsidiaries, are third
                        party beneficiaries of this Agreement, and that upon your acceptance of these
                        terms, Apple will have the right (and will be deemed to have accepted the
                        right) to enforce this Agreement against you as a third party beneficiary
                        of it.
                    </Section>

                    <Section heading="16. Changes to These Terms">
                        We may update these Terms from time to time. Continued use of the app after
                        changes take effect constitutes acceptance of the revised Terms.
                    </Section>

                    <Section heading="17. Contact">
                        Bhole Shankar Enterprises Private Limited. Questions about these Terms?
                        Email info@bholeshankarenterprisesprivatelimited.com, or visit
                        bseptechnologies.com/paper-ai/support.
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
    updated: { color: t.colors.placeholder, fontWeight: "700", fontSize: 12, marginTop: 4, marginBottom: 8 },
    intro: { color: t.colors.textSecondary, lineHeight: 21, fontWeight: "600", marginTop: 4 },
    section: { marginTop: 16 },
    heading: { color: t.colors.accentText, fontWeight: "900", fontSize: 15, marginBottom: 6 },
    text: { color: t.colors.textSecondary, lineHeight: 22, fontWeight: "600" },
});
