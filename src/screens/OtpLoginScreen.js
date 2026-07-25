import React, { useState } from "react";
import {
    View, Text, TextInput, Alert, StyleSheet, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { sendPhoneOtp, verifyPhoneOtp } from "../api/auth";

export default function OtpLoginScreen({ navigation, onAuthed }) {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState("phone"); // "phone" | "otp"
    const [busy, setBusy] = useState(false);

    async function sendOtp() {
        const trimmed = phone.trim();
        if (!trimmed) return Alert.alert("Required", "Enter your phone number.");
        // Ensure E.164 format reminder
        if (!trimmed.startsWith("+")) {
            return Alert.alert(
                "Format",
                "Include country code — e.g. +91 9876543210 for India."
            );
        }
        try {
            setBusy(true);
            await sendPhoneOtp(trimmed);
            setStep("otp");
        } catch (e) {
            Alert.alert("Error", e?.userMessage ?? e?.message ?? "Could not send OTP.");
        } finally {
            setBusy(false);
        }
    }

    async function verifyOtp() {
        if (!otp.trim()) return Alert.alert("Required", "Enter the OTP code.");
        try {
            setBusy(true);
            await verifyPhoneOtp(phone.trim(), otp.trim());
            onAuthed();
        } catch (e) {
            Alert.alert("Invalid OTP", e?.userMessage ?? e?.message ?? "Verification failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    {/* Back */}
                    <Pressable onPress={() => step === "otp" ? setStep("phone") : navigation.goBack()} style={styles.back}>
                        <Ionicons name="arrow-back" size={22} color="#2563EB" />
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    <View style={styles.card}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="phone-portrait-outline" size={32} color="#4F8CFF" />
                        </View>

                        <Text style={styles.title}>
                            {step === "phone" ? "Phone login" : "Enter OTP"}
                        </Text>
                        <Text style={styles.subtitle}>
                            {step === "phone"
                                ? "We'll send a 6-digit code to your phone."
                                : `Code sent to ${phone.trim()}`}
                        </Text>

                        {step === "phone" ? (
                            <View style={styles.inputWrap}>
                                <Ionicons name="call-outline" size={18} color="#6B7280" />
                                <TextInput
                                    placeholder="+91 9876543210"
                                    placeholderTextColor="#6B7280"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                    style={styles.input}
                                    autoFocus
                                />
                            </View>
                        ) : (
                            <View style={styles.inputWrap}>
                                <Ionicons name="keypad-outline" size={18} color="#6B7280" />
                                <TextInput
                                    placeholder="6-digit code"
                                    placeholderTextColor="#6B7280"
                                    keyboardType="number-pad"
                                    value={otp}
                                    onChangeText={setOtp}
                                    maxLength={6}
                                    style={styles.input}
                                    autoFocus
                                />
                            </View>
                        )}

                        <View style={{ marginTop: 6 }}>
                            <AppButton
                                title={busy ? "Please wait..." : step === "phone" ? "Send code" : "Verify"}
                                onPress={step === "phone" ? sendOtp : verifyOtp}
                                disabled={busy}
                            />
                        </View>

                        {step === "otp" && (
                            <Pressable onPress={() => { setOtp(""); sendOtp(); }} disabled={busy}>
                                <Text style={styles.resend}>Resend code</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, justifyContent: "center" },
    back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start" },
    backText: { color: "#2563EB", fontWeight: "700" },

    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 22, padding: 20,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    iconWrap: {
        width: 60, height: 60, borderRadius: 18,
        backgroundColor: "rgba(79,140,255,0.12)",
        alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    title: { color: "#111111", fontSize: 22, fontWeight: "800", marginBottom: 4 },
    subtitle: { color: "#6B7280", marginBottom: 18, lineHeight: 20 },

    inputWrap: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.82)",
        borderWidth: 1, borderColor: "#D1D5DB",
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 4,
    },
    input: { flex: 1, color: "#111111", fontSize: 16 },
    resend: { marginTop: 14, color: "#2563EB", textAlign: "center", fontWeight: "700" },
});
