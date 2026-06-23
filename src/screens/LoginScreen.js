import React, { useMemo, useRef, useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    Alert,
    StyleSheet,
    Image,
    Pressable,
    Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { login } from "../api/auth";

export default function LoginScreen({ navigation, onAuthed }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const logo = useMemo(() => require("../../assets/logo.png"), []);

    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.03, duration: 1400, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1.0, duration: 1400, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    async function onLogin() {
        try {
            setBusy(true);
            await login(email.trim(), password);
            onAuthed();
        } catch (e) {
            Alert.alert("Login failed", e?.userMessage ?? e?.message ?? "Something went wrong.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Animated.View style={[styles.brandWrap, { transform: [{ scale: pulse }] }]}>
                        <View style={styles.logoRing}>
                            <Image source={logo} style={styles.logo} resizeMode="contain" />
                        </View>
                        <Text style={styles.brand}>PaperAI</Text>
                        <Text style={styles.tagline}>Upload documents. Get instant AI insights.</Text>
                    </Animated.View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Sign in</Text>

                        <View style={styles.inputWrap}>
                            <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.7)" />
                            <TextInput
                                placeholder="Email address"
                                placeholderTextColor="rgba(255,255,255,0.45)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.inputWrap}>
                            <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.7)" />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor="rgba(255,255,255,0.45)"
                                secureTextEntry={!showPw}
                                value={password}
                                onChangeText={setPassword}
                                style={styles.input}
                            />
                            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
                                <Ionicons
                                    name={showPw ? "eye-off-outline" : "eye-outline"}
                                    size={18}
                                    color="rgba(255,255,255,0.7)"
                                />
                            </Pressable>
                        </View>

                        <View style={{ marginTop: 6 }}>
                            <AppButton
                                title={busy ? "Signing in..." : "Sign in"}
                                onPress={onLogin}
                                disabled={busy}
                            />
                        </View>

                        <View style={styles.rowLinks}>
                            <Text
                                onPress={() => navigation.navigate("OtpLogin")}
                                style={styles.link}
                            >
                                Continue with OTP
                            </Text>

                            <Text
                                onPress={() => navigation.navigate("Register")}
                                style={styles.linkStrong}
                            >
                                Create an account →
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.footerNote}>
                        Built for fast, private document intelligence.
                    </Text>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, justifyContent: "center" },
    brandWrap: { alignItems: "center", marginBottom: 18 },
    logoRing: {
        width: 84,
        height: 84,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    logo: { width: 56, height: 56 },
    brand: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: 0.2 },
    tagline: { marginTop: 6, color: "rgba(255,255,255,0.72)", textAlign: "center" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
    },
    cardTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 10 },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(0,0,0,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        marginBottom: 10,
    },
    input: { flex: 1, color: "#fff", fontSize: 15 },

    rowLinks: {
        marginTop: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    link: { color: "rgba(255,255,255,0.78)", fontWeight: "700" },
    linkStrong: { color: "#A5B4FC", fontWeight: "900" },

    footerNote: {
        marginTop: 16,
        textAlign: "center",
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
    },
});
