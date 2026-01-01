import React, { useState } from "react";
import { View, Text, TextInput, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { sendPhoneOtp, verifyPhoneOtp } from "../api/auth";

export default function OtpLoginScreen({ navigation, onAuthed }) {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState("phone");
    const [busy, setBusy] = useState(false);

    async function sendOtp() {
        try {
            setBusy(true);
            await sendPhoneOtp(phone.trim());
            setStep("otp");
        } catch (e) {
            Alert.alert("Error", e?.response?.data || e.message);
        } finally {
            setBusy(false);
        }
    }

    async function verifyOtp() {
        try {
            setBusy(true);
            await verifyPhoneOtp(phone.trim(), otp.trim());
            onAuthed();
        } catch (e) {
            Alert.alert("Invalid OTP", e?.response?.data || e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>
                    {step === "phone" ? "Login with OTP" : "Enter OTP"}
                </Text>

                <TextInput
                    placeholder={step === "phone" ? "Phone number" : "6-digit OTP"}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="number-pad"
                    value={step === "phone" ? phone : otp}
                    onChangeText={step === "phone" ? setPhone : setOtp}
                    style={styles.input}
                />

                <AppButton
                    title={
                        busy
                            ? "Please wait..."
                            : step === "phone"
                                ? "Send OTP"
                                : "Verify OTP"
                    }
                    onPress={step === "phone" ? sendOtp : verifyOtp}
                    disabled={busy}
                />

                <Text style={styles.link} onPress={() => navigation.goBack()}>
                    ← Back
                </Text>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: "center" },
    title: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 14 },
    input: {
        backgroundColor: "rgba(0,0,0,0.25)",
        borderRadius: 16,
        padding: 14,
        color: "#fff",
        marginBottom: 12,
    },
    link: {
        marginTop: 16,
        color: "#A5B4FC",
        textAlign: "center",
        fontWeight: "700",
    },
});
