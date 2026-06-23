import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Alert,
    StyleSheet,
    Animated,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { getCreditsBalance } from "../api/credits";
import { API } from "../constants/api";

export default function UploadScreen({ navigation }) {
    const [busy, setBusy] = useState(false);
    const [credits, setCredits] = useState(null);
    const lift = useRef(new Animated.Value(0)).current;

    async function refreshCredits() {
        try {
            const res = await getCreditsBalance();
            setCredits(res.credits);
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
                Animated.timing(lift, {
                    toValue: -4,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(lift, {
                    toValue: 0,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [lift]);

    async function uploadFile(uri, name, mimeType) {
        const token = await SecureStore.getItemAsync("accessToken");
        if (!token) throw new Error("Authentication required. Please log in again.");

        const form = new FormData();
        form.append("file", {
            uri,
            name: name || "upload",
            type: mimeType || "application/octet-stream",
        });

        const res = await fetch(`${API.BASE_URL}/api/documents/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }

        if (!res.ok) {
            throw new Error(data?.message || `Upload failed (${res.status})`);
        }

        return data;
    }

    async function pickPhoto() {
        if (busy) return;
        try {
            setBusy(true);

            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(
                    "Permission required",
                    "Please allow photo library access in Settings to upload images."
                );
                return;
            }

            const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                allowsEditing: false,
                allowsMultipleSelection: false,
            });

            if (picked.canceled) return;

            const asset = picked.assets[0];
            const ext = asset.uri.split(".").pop() || "jpg";
            const mimeType = asset.mimeType || `image/${ext}`;
            const fileName = asset.fileName || `photo.${ext}`;

            const data = await uploadFile(asset.uri, fileName, mimeType);

            navigation.navigate("Process", {
                docId: data.id,
                title: data.title,
                fileUrl: data.url,
            });
        } catch (err) {
            Alert.alert("Upload failed", err.message);
        } finally {
            setBusy(false);
            refreshCredits();
        }
    }

    async function pickDocument() {
        if (busy) return;
        try {
            setBusy(true);

            const picked = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                multiple: false,
                type: "application/pdf",
            });

            if (picked.canceled) return;

            const file = picked.assets[0];
            const data = await uploadFile(file.uri, file.name, file.mimeType || "application/pdf");

            navigation.navigate("Process", {
                docId: data.id,
                title: data.title,
                fileUrl: data.url,
            });
        } catch (err) {
            Alert.alert("Upload failed", err.message);
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

                    <Animated.View
                        style={[styles.uploader, { transform: [{ translateY: lift }] }]}
                    >
                        <View style={styles.uploaderTop}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="cloud-upload-outline" size={26} color="#E0E7FF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.uTitle}>Drop in a document</Text>
                                <Text style={styles.uSub}>
                                    PDF or image — we'll extract text and run AI analysis.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.buttonRow}>
                            <Pressable
                                style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.7 }]}
                                onPress={pickPhoto}
                                disabled={busy}
                            >
                                <Ionicons name="image-outline" size={20} color="#A5B4FC" />
                                <Text style={styles.pickBtnText}>Photo / Image</Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [styles.pickBtn, pressed && { opacity: 0.7 }]}
                                onPress={pickDocument}
                                disabled={busy}
                            >
                                <Ionicons name="document-outline" size={20} color="#A5B4FC" />
                                <Text style={styles.pickBtnText}>PDF Document</Text>
                            </Pressable>
                        </View>

                        {busy && (
                            <Text style={styles.uploadingText}>Uploading…</Text>
                        )}

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
                        <Tip icon="bulb-outline" text="Best results with clear text PDFs or images." />
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
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
    uploaderTop: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
    },
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
    divider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.10)",
        marginVertical: 14,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 10,
    },
    pickBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "rgba(99,102,241,0.18)",
        borderWidth: 1,
        borderColor: "rgba(165,180,252,0.35)",
        borderRadius: 16,
        paddingVertical: 14,
    },
    pickBtnText: { color: "#E0E7FF", fontWeight: "800", fontSize: 14 },
    uploadingText: {
        marginTop: 12,
        color: "rgba(255,255,255,0.7)",
        textAlign: "center",
        fontWeight: "700",
    },
    upgrade: {
        marginTop: 14,
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
