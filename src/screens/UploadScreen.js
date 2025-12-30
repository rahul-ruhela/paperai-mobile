import React, { useEffect, useState } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import AppButton from "../ui/AppButton";
import { getCreditsBalance } from "../api/credits";

export default function UploadScreen({ navigation }) {
    const [busy, setBusy] = useState(false);
    const [credits, setCredits] = useState(null);

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

            const uploadUrl = "http://YOUR_API_HOST/api/documents/upload";

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
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
            <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
                <Text style={{ fontSize: 22, fontWeight: "800" }}>Upload</Text>

                <View style={{ backgroundColor: "#fff", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" }}>
                    <Text style={{ fontWeight: "700" }}>Credits</Text>
                    <Text style={{ marginTop: 6, color: "#6B7280" }}>
                        {credits === null ? "Loading…" : `${credits} credits available`}
                    </Text>
                </View>

                <Text style={{ color: "#6B7280" }}>
                    Upload a PDF/image and we’ll analyze it with AI.
                </Text>

                <AppButton
                    title={busy ? "Uploading…" : "Pick file & Upload"}
                    onPress={pickAndUpload}
                    disabled={busy}
                />

                <Text
                    onPress={() => navigation.navigate("Paywall")}
                    style={{ textAlign: "center", color: "#4F46E5", fontWeight: "700" }}
                >
                    Upgrade for more credits
                </Text>
            </View>
        </SafeAreaView>
    );
}
