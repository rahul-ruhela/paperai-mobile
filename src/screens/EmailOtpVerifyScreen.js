import React, { useState } from "react";
import { Text, TextInput, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { verifyEmailOtp } from "../api/auth";

export default function EmailOtpVerifyScreen({ route, onAuthed }) {
    const { email, name, password, phone } = route.params;
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);

    async function verify() {
        try {
            setBusy(true);
            await verifyEmailOtp({
                email,
                code: code.trim(),
                name,
                password,
                phone,
            });
            onAuthed();
        } catch (e) {
            Alert.alert("Verification failed", e?.userMessage ?? e?.message ?? "Verification failed. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>Verify your email</Text>
                <Text style={styles.subtitle}>Code sent to {email}</Text>

                <TextInput
                    placeholder="6-digit code"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={setCode}
                    style={styles.input}
                />

                <AppButton
                    title={busy ? "Verifying..." : "Verify"}
                    onPress={verify}
                    disabled={busy}
                />
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: "center" },
    title: { color: "#fff", fontSize: 22, fontWeight: "800" },
    subtitle: { color: "rgba(255,255,255,0.7)", marginBottom: 14 },
    input: {
        backgroundColor: "rgba(0,0,0,0.25)",
        borderRadius: 16,
        padding: 14,
        color: "#fff",
        marginBottom: 12,
    },
});
