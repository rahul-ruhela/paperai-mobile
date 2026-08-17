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
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { login, appleLogin } from "../api/auth";

// Apple Sign In is only available on iOS native builds (not Expo Go / web)
let AppleAuthentication = null;
try {
    AppleAuthentication = require("expo-apple-authentication");
} catch (_) {}

// Detects Expo Go at runtime.
// In Expo Go, Apple issues the identity token with aud = "host.exp.Exponent".
// The dev backend accepts this via Apple:ClientIdAlt = "host.exp.Exponent".
// In a production standalone build (App Store / TestFlight / EAS),
// appOwnership is "standalone" and executionEnvironment is "standalone",
// so isExpoGo is false and Apple sends aud = "com.bholeshankar.paperai".
const isExpoGo =
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient";

export default function LoginScreen({ navigation, onAuthed }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);
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

    useEffect(() => {
        if (Platform.OS === "ios" && AppleAuthentication?.isAvailableAsync) {
            AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
        }
    }, []);

    async function onLogin() {
        if (!email.trim() || !password) return Alert.alert("Required", "Enter email and password.");
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

    async function onAppleSignIn() {
        if (!AppleAuthentication) return;

        if (isExpoGo) {
            // In Expo Go the token's audience is "host.exp.Exponent".
            // The dev backend accepts this. Production builds use the real bundle ID.
            console.warn("[AppleSignIn] Running in Expo Go — token audience is host.exp.Exponent (dev only)");
        }

        try {
            setBusy(true);
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                Alert.alert("Apple Sign In failed", "Apple did not return a token. Please try again.");
                return;
            }

            const fullName = credential.fullName
                ? [credential.fullName.givenName, credential.fullName.familyName]
                      .filter(Boolean)
                      .join(" ")
                : null;

            await appleLogin(credential.identityToken, credential.email, fullName);
            onAuthed();
        } catch (e) {
            if (e?.code === "ERR_REQUEST_CANCELED") return; // user dismissed the sheet
            Alert.alert("Apple Sign In failed", e?.userMessage ?? e?.message ?? "Something went wrong.");
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
                            <Ionicons name="mail-outline" size={18} color="#6B7280" />
                            <TextInput
                                placeholder="Email address"
                                placeholderTextColor="#6B7280"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.inputWrap}>
                            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor="#6B7280"
                                secureTextEntry={!showPw}
                                value={password}
                                onChangeText={setPassword}
                                style={styles.input}
                            />
                            <Pressable onPress={() => setShowPw(s => !s)} hitSlop={10}>
                                <Ionicons
                                    name={showPw ? "eye-off-outline" : "eye-outline"}
                                    size={18}
                                    color="#6B7280"
                                />
                            </Pressable>
                        </View>

                        <View style={{ marginTop: 4 }}>
                            <AppButton
                                title={busy ? "Signing in..." : "Sign in"}
                                onPress={onLogin}
                                disabled={busy}
                            />
                        </View>

                        {/* Divider */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Apple Sign In */}
                        {appleAvailable && (
                            <Pressable
                                style={[styles.socialBtn, busy && { opacity: 0.5 }]}
                                onPress={onAppleSignIn}
                                disabled={busy}
                            >
                                <Ionicons name="logo-apple" size={20} color="#000" />
                                <Text style={styles.socialBtnText}>Continue with Apple</Text>
                            </Pressable>
                        )}

                        {/* Phone OTP — hidden until the Twilio SMS plan is active.
                            Sending an OTP currently fails, and App Review rejects
                            non-functional features (guideline 2.1). The OtpLogin
                            screen and route are kept intact: restore this block to
                            re-enable phone login once SMS delivery works.
                        <Pressable
                            style={[styles.socialBtnOutline, busy && { opacity: 0.5 }]}
                            onPress={() => navigation.navigate("OtpLogin")}
                            disabled={busy}
                        >
                            <Ionicons name="phone-portrait-outline" size={20} color="#2563EB" />
                            <Text style={styles.socialBtnOutlineText}>Continue with Phone OTP</Text>
                        </Pressable>
                        */}

                        <View style={styles.rowLinks}>
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
        width: 84, height: 84, borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        alignItems: "center", justifyContent: "center", marginBottom: 12,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    logo: { width: 56, height: 56 },
    brand: { fontSize: 30, fontWeight: "800", color: "#111111", letterSpacing: 0.2 },
    tagline: { marginTop: 6, color: "#6B7280", textAlign: "center" },

    card: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 22, padding: 16,
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    cardTitle: { color: "#111111", fontSize: 18, fontWeight: "800", marginBottom: 10 },
    inputWrap: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.82)",
        borderWidth: 1, borderColor: "#D1D5DB",
        borderRadius: 14, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 10,
    },
    input: { flex: 1, color: "#111111", fontSize: 15 },

    dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 14, gap: 8 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
    dividerText: { color: "#6B7280", fontSize: 13 },

    socialBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: "#fff", borderRadius: 14, paddingVertical: 15, marginBottom: 10,
        borderWidth: 1, borderColor: "#E5E7EB",
    },
    socialBtnText: { color: "#111111", fontWeight: "700", fontSize: 15 },

    socialBtnOutline: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.72)",
        borderWidth: 1, borderColor: "#4F8CFF",
        borderRadius: 14, paddingVertical: 15, marginBottom: 4,
    },
    socialBtnOutlineText: { color: "#2563EB", fontWeight: "700", fontSize: 15 },

    rowLinks: { marginTop: 14, alignItems: "center" },
    linkStrong: { color: "#2563EB", fontWeight: "800" },

    footerNote: {
        marginTop: 16, textAlign: "center",
        color: "#6B7280", fontSize: 12,
    },
});
