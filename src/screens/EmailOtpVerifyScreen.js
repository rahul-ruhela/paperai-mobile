import React, { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { verifyEmailOtp, sendEmailOtp } from "../api/auth";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
export default function EmailOtpVerifyScreen({ route, navigation, onAuthed }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
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
                        <Ionicons name="arrow-back" size={22} color={theme.colors.accentText} />
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    <View style={styles.card}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="mail-open-outline" size={32} color={theme.colors.primary} />
                        </View>

                        <Text style={styles.title}>Check your email</Text>
                        <Text style={styles.subtitle}>
                            We sent a 6-digit code to{"\n"}
                            <Text style={styles.emailHighlight}>{email}</Text>
                        </Text>

                        <View style={styles.inputWrap}>
                            <Ionicons name="keypad-outline" size={18} color={theme.colors.textMuted} />
                            <TextInput
                                placeholder="6-digit code"
                                placeholderTextColor={theme.colors.textMuted}
                                keyboardType="number-pad"
                                value={code}
                                onChangeText={setCode}
                                maxLength={6}
                                style={styles.input}
                                autoFocus keyboardAppearance={theme.keyboardAppearance} />
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

const makeStyles = (t) =>
    StyleSheet.create({
    container: { flex: 1, padding: 18, justifyContent: "center" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
    backText: { color: t.colors.accentText, fontWeight: "700" },

    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 22, padding: 20,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    iconWrap: {
        width: 60, height: 60, borderRadius: 18,
        backgroundColor: t.colors.infoBg,
        alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    title: { color: t.colors.textPrimary, fontSize: 22, fontWeight: "800", marginBottom: 6 },
    subtitle: { color: t.colors.textMuted, marginBottom: 18, lineHeight: 22 },
    emailHighlight: { color: t.colors.accentText, fontWeight: "700" },

    inputWrap: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: t.colors.inputBg,
        borderWidth: 1, borderColor: t.colors.inputBorder,
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 4,
    },
    input: { flex: 1, color: t.colors.textPrimary, fontSize: 20, letterSpacing: 6, fontWeight: "700" },
    resend: { marginTop: 14, color: t.colors.accentText, textAlign: "center", fontWeight: "700" },
});
