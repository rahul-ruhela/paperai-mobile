import React, { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { verifyEmailOtp, sendEmailOtp } from "../api/auth";

export default function EmailOtpVerifyScreen({ route, navigation, onAuthed }) {
    const { email, name, password, phone } = route.params;
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [resending, setResending] = useState(false);

    async function verify() {
        if (!code.trim()) return Alert.alert("Required", "Enter the 6-digit code.");
        try {
            setBusy(true);
            await verifyEmailOtp({ email, code: code.trim(), name, password, phone });
            onAuthed();
        } catch (e) {
            Alert.alert("Verification failed", e?.userMessage ?? e?.message ?? "Please try again.");
        } finally {
            setBusy(false);
        }
    }

    async function resend() {
        try {
            setResending(true);
            await sendEmailOtp(email);
            setCode("");
            Alert.alert("Sent", "A new code has been sent to your email.");
        } catch (e) {
            Alert.alert("Error", e?.userMessage ?? "Could not resend code.");
        } finally {
            setResending(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                        <Ionicons name="arrow-back" size={22} color="#A5B4FC" />
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    <View style={styles.card}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="mail-open-outline" size={32} color="#A5B4FC" />
                        </View>

                        <Text style={styles.title}>Check your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a 6-digit code to{"\n"}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>

                        <View style={styles.inputWrap}>
                            <Ionicons name="keypad-outline" size={18} color="rgba(255,255,255,0.7)" />
                            <TextInput
                                placeholder="6-digit code"
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                keyboardType="number-pad"
                                value={code}
                                onChangeText={setCode}
                                maxLength={6}
                                style={styles.input}
                                autoFocus
                            />
                        </View>

                        <View style={{ marginTop: 6 }}>
                            <AppButton
                                title={busy ? "Verifying..." : "Verify & Create Account"}
                                onPress={verify}
                                disabled={busy || resending}
                            />
                        </View>

                        <Pressable onPress={resend} disabled={busy || resending}>
                            <Text style={styles.resend}>
                                {resending ? "Sending..." : "Resend code"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, justifyContent: "center" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
    backText: { color: "#A5B4FC", fontWeight: "700" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22, padding: 20,
    },
    iconWrap: {
        width: 60, height: 60, borderRadius: 18,
        backgroundColor: "rgba(165,180,252,0.12)",
        alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    title: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 6 },
    subtitle: { color: "rgba(255,255,255,0.65)", marginBottom: 18, lineHeight: 22 },
    emailHighlight: { color: "#A5B4FC", fontWeight: "700" },

    inputWrap: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(0,0,0,0.18)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 16, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 4,
    },
    input: { flex: 1, color: "#fff", fontSize: 20, letterSpacing: 6, fontWeight: "700" },
    resend: { marginTop: 14, color: "#A5B4FC", textAlign: "center", fontWeight: "700" },
});
