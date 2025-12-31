import React, { useEffect, useRef, useState } from "react";
import { View, Text, Alert, StyleSheet, Animated, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { getCreditsBalance } from "../api/credits";

export default function UploadScreen({ navigation }) {
    const [busy, setBusy] = useState(false);
    const [credits, setCredits] = useState(null);

    const lift = useRef(new Animated.Value(0)).current;

    async function refreshCredits() {
        try {
            const b = await getCreditsBalance();
            setCredits(b.credits);
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        const unsub = navigation.addListener("focus", refreshCredits);
        refreshCredits();
        return unsub;
    }, [navigation]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(lift, { toValue: -4, duration: 1200, useNativeDriver: true }),
                Animated.timing(lift, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, [lift]);

    async function pickAndUpload() {
        try {
            setBusy(true);

            const picked = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (picked.canceled) return;

            const file = picked.assets[0];
            const accessToken = await SecureStore.getItemAsync("accessToken");
            if (!accessToken) throw new Error("No access token");

            const uploadUrl = "http://192.168.29.223:5263/api/documents/upload";
            const form = new FormData();
            form.append("file", {
                uri: file.uri,
                name: file.name,
                type: file.mimeType || "application/octet-stream",
            });

            const res = await fetch(uploadUrl, {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
                body: form,
            });

            const text = await res.text();
            if (!res.ok) throw new Error(text);

            const json = JSON.parse(text);
            navigation.navigate("Process", { docId: json.id, title: json.title });
        } catch (e) {
            Alert.alert("Upload failed", e.message);
        } finally {
            setBusy(false);
            refreshCredits();
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.hTitle}>Upload</Text>
                        <View style={styles.badge}>
                            <Ionicons name="flash-outline" size={14} color="#A5B4FC" />
                            <Text style={styles.badgeText}>
                                {credits === null ? "Loading…" : `${credits} credits`}
                            </Text>
                        </View>
                    </View>

                    <Animated.View style={[styles.uploader, { transform: [{ translateY: lift }] }]}>
                        <View style={styles.uploaderTop}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="cloud-upload-outline" size={26} color="#E0E7FF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.uTitle}>Drop in a document</Text>
                                <Text style={styles.uSub}>
                                    PDF or image — we’ll extract text and run AI analysis.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <AppButton
                            title={busy ? "Uploading…" : "Pick file & Upload"}
                            onPress={pickAndUpload}
                            disabled={busy}
                        />

                        <Pressable
                            onPress={() => navigation.navigate("Paywall")}
                            style={({ pressed }) => [styles.upgrade, pressed && { opacity: 0.7 }]}
                        >
                            <Ionicons name="sparkles-outline" size={16} color="#FBCFE8" />
                            <Text style={styles.upgradeText}>Upgrade for more credits</Text>
                        </Pressable>
                    </Animated.View>

                    <View style={styles.tips}>
                        <Tip icon="lock-closed-outline" text="Your documents stay private to your account." />
                        <Tip icon="time-outline" text="Most uploads process in seconds." />
                        <Tip icon="bulb-outline" text="Best results with clear text PDFs." />
                    </View>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Tip({ icon, text }) {
    return (
        <View style={styles.tipRow}>
            <Ionicons name={icon} size={16} color="rgba(255,255,255,0.75)" />
            <Text style={styles.tipText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    hTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
    },
    badgeText: { color: "#E0E7FF", fontWeight: "800" },

    uploader: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
    },
    uploaderTop: { flexDirection: "row", gap: 12, alignItems: "center" },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: "rgba(99,102,241,0.22)",
        borderWidth: 1,
        borderColor: "rgba(165,180,252,0.35)",
        alignItems: "center",
        justifyContent: "center",
    },
    uTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
    uSub: { marginTop: 4, color: "rgba(255,255,255,0.68)", lineHeight: 18 },

    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 14 },

    upgrade: {
        marginTop: 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
    },
    upgradeText: { color: "#FBCFE8", fontWeight: "900" },

    tips: { marginTop: 4, gap: 10 },
    tipRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    tipText: { color: "rgba(255,255,255,0.70)", fontWeight: "700" },
});
