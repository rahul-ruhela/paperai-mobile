import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function PrivacyScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Privacy Policy</Text>

                    <Text style={styles.h}>What We Collect</Text>
                    <Text style={styles.text}>
                        PaperAI collects account information you provide (such as email) and the app content you upload
                        (documents and images) to deliver features like parsing, analysis, and export.
                    </Text>

                    <Text style={styles.h}>How We Use Your Data</Text>
                    <Text style={styles.text}>
                        We use your data only to operate and improve the service, provide support, prevent abuse, and
                        maintain security. We do not sell your personal data.
                    </Text>

                    <Text style={styles.h}>Sharing</Text>
                    <Text style={styles.text}>
                        We do not share your documents with third parties for advertising. Where external services are
                        used to process requests (for example, infrastructure or AI processing), they act on our behalf
                        to provide the service.
                    </Text>

                    <Text style={styles.h}>Security</Text>
                    <Text style={styles.text}>
                        We use reasonable technical and organizational measures to protect your information. No method
                        of transmission or storage is 100% secure, so we cannot guarantee absolute security.
                    </Text>

                    <Text style={styles.h}>Retention & Deletion</Text>
                    <Text style={styles.text}>
                        Uploaded content is retained only as long as needed to provide the service and comply with legal
                        obligations. You may request deletion by contacting support.
                    </Text>

                    <Text style={styles.h}>Contact</Text>
                    <Text style={styles.text}>
                        If you have questions about this Privacy Policy, contact: support@paperai.app
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
