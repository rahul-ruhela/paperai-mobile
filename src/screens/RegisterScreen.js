import React, { useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Alert,
    StyleSheet,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { sendEmailOtp,register } from "../api/auth";

export default function RegisterScreen({ navigation }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    const logo = useMemo(() => require("../../assets/logo.png"), []);

    async function onRegister() {
        try {
            if (!name.trim())
                return Alert.alert("Validation", "Name is required");
            if (!email.trim())
                return Alert.alert("Validation", "Email is required");
            if (!password)
                return Alert.alert("Validation", "Password is required");

            setBusy(true);

            await sendEmailOtp(email.trim());

            navigation.navigate("EmailOtpVerify", {
                name: name.trim(),
                email: email.trim(),
                password,
                phone: phone?.trim() || null,
            });
        } catch (e) {
            Alert.alert("Register failed", e?.userMessage ?? e?.message ?? "Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <View style={styles.brandWrap}>
                        <View style={styles.logoRing}>
                            <Image source={logo} style={styles.logo} resizeMode="contain" />
                        </View>
                        <Text style={styles.title}>Create your account</Text>
                        <Text style={styles.subtitle}>
                            We’ll email you a verification code.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <Field icon="person-outline" placeholder="Name" value={name} onChangeText={setName} />
                        <Field
                            icon="mail-outline"
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <Field
                            icon="call-outline"
                            placeholder="Phone (optional)"
                            value={phone}
                            onChangeText={setPhone}
                        />
                        <Field
                            icon="lock-closed-outline"
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <View style={{ marginTop: 6 }}>
                            <AppButton
                                title={busy ? "Sending code..." : "Continue"}
                                onPress={onRegister}
                                disabled={busy}
                            />
                        </View>

                        <Text onPress={() => navigation.goBack?.()} style={styles.link}>
                            ← Back to login
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Field({ icon, ...props }) {
    return (
        <View style={styles.inputWrap}>
            <Ionicons name={icon} size={18} color="#6B7280" />
            <TextInput
                placeholderTextColor="#6B7280"
                style={styles.input}
                {...props}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, justifyContent: "center" },
    brandWrap: { alignItems: "center", marginBottom: 14 },
    logoRing: {
        width: 74,
        height: 74,
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    logo: { width: 50, height: 50 },
    title: { fontSize: 22, fontWeight: "800", color: "#111111" },
    subtitle: {
        marginTop: 6,
        color: "#6B7280",
        textAlign: "center",
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 22,
        padding: 16,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(255,255,255,0.82)",
        borderWidth: 1,
        borderColor: "#D1D5DB",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 14,
        marginBottom: 10,
    },
    input: { flex: 1, color: "#111111", fontSize: 15 },
    link: {
        marginTop: 14,
        color: "#2563EB",
        fontWeight: "800",
        textAlign: "center",
    },
});
