import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import { API } from "../constants/api";

// ── Upload helper ──────────────────────────────────────────────────────────────
async function uploadFile(uri) {
    const token = await SecureStore.getItemAsync("accessToken");
    if (!token) throw new Error("Authentication required. Please log in again.");

    const filename = `scan_${Date.now()}.jpg`;
    const form = new FormData();
    form.append("file", { uri, name: filename, type: "image/jpeg" });

    const res = await fetch(`${API.BASE_URL}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok) throw new Error(data?.message || `Upload failed (${res.status})`);
    return data;
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CameraDocumentScanScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedUri, setCapturedUri] = useState(null);
    const [uploading, setUploading] = useState(false);
    const cameraRef = useRef(null);

    // ── Permission states ──────────────────────────────────────────────────────
    if (!permission) {
        // Still loading permission status
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#A5B4FC" />
            </View>
        );
    }

    if (!permission.granted) {
        const canAsk = permission.canAskAgain;
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <View style={styles.permissionBox}>
                    <Ionicons name="camera-outline" size={52} color="#A5B4FC" />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionSubtitle}>
                        Paper AI needs camera access to scan and capture documents.
                    </Text>
                    {canAsk ? (
                        <Pressable
                            style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.75 }]}
                            onPress={requestPermission}
                        >
                            <Text style={styles.permBtnText}>Grant Permission</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.75 }]}
                            onPress={() => Linking.openSettings()}
                        >
                            <Ionicons name="settings-outline" size={16} color="#020617" />
                            <Text style={styles.permBtnText}>Open Settings</Text>
                        </Pressable>
                    )}
                    <Pressable
                        style={styles.permCancelBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.permCancelText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // ── Capture ────────────────────────────────────────────────────────────────
    async function handleCapture() {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.9,
                base64: false,
            });
            setCapturedUri(photo.uri);
        } catch (err) {
            Alert.alert("Capture failed", err.message || "Could not take photo. Please try again.");
        }
    }

    // ── Use photo ──────────────────────────────────────────────────────────────
    async function handleUsePhoto() {
        if (!capturedUri || uploading) return;
        try {
            setUploading(true);
            const data = await uploadFile(capturedUri);
            navigation.navigate("Process", { docId: data.id, title: data.title });
        } catch (err) {
            Alert.alert("Upload failed", err.message || "Could not upload photo. Please try again.");
        } finally {
            setUploading(false);
        }
    }

    // ── Preview screen (after capture) ────────────────────────────────────────
    if (capturedUri) {
        return (
            <View style={styles.root}>
                <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />

                {/* Dark overlay at top for back button */}
                <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    {/* Top bar */}
                    <View style={styles.previewTopBar}>
                        <Pressable
                            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => setCapturedUri(null)}
                            disabled={uploading}
                        >
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </Pressable>
                        <Text style={styles.previewTitle}>Preview</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    {/* Bottom action buttons */}
                    <View style={styles.previewBottomBar}>
                        <Pressable
                            style={({ pressed }) => [styles.retakeBtn, pressed && { opacity: 0.75 }, uploading && { opacity: 0.4 }]}
                            onPress={() => setCapturedUri(null)}
                            disabled={uploading}
                        >
                            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
                            <Text style={styles.retakeBtnText}>Retake</Text>
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [styles.usePhotoBtn, pressed && { opacity: 0.85 }, uploading && { opacity: 0.7 }]}
                            onPress={handleUsePhoto}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <ActivityIndicator size="small" color="#020617" />
                                    <Text style={styles.usePhotoBtnText}>Uploading…</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#020617" />
                                    <Text style={styles.usePhotoBtnText}>Use This Photo</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // ── Camera viewfinder ──────────────────────────────────────────────────────
    return (
        <View style={styles.root}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
            />

            {/* Document frame overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Dark scrim outside the frame */}
                <View style={styles.scrimTop} />
                <View style={styles.scrimMiddleRow}>
                    <View style={styles.scrimSide} />
                    {/* Transparent window */}
                    <View style={styles.frameWindow}>
                        {/* Corner brackets */}
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <View style={styles.scrimSide} />
                </View>
                <View style={styles.scrimBottom} />
            </View>

            {/* UI controls */}
            <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {/* Top bar */}
                <View style={styles.topBar}>
                    <Pressable
                        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.scanHint}>Position document inside the frame</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Bottom capture area */}
                <View style={styles.bottomBar}>
                    <Pressable
                        style={({ pressed }) => [styles.captureBtn, pressed && { transform: [{ scale: 0.94 }] }]}
                        onPress={handleCapture}
                        accessibilityLabel="Capture document"
                        accessibilityRole="button"
                    >
                        <View style={styles.captureBtnInner} />
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const FRAME_W = 280;
const FRAME_H = 380;
const SCRIM = "rgba(2,6,23,0.60)";
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#fff";
const CORNER_RADIUS = 5;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#020617",
    },

    // ── Permission screen ──
    centeredContainer: {
        flex: 1,
        backgroundColor: "#020617",
        alignItems: "center",
        justifyContent: "center",
    },
    permissionBox: {
        alignItems: "center",
        paddingHorizontal: 32,
        gap: 14,
    },
    permissionTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "900",
        textAlign: "center",
        marginTop: 8,
    },
    permissionSubtitle: {
        color: "rgba(255,255,255,0.60)",
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
        lineHeight: 20,
    },
    permBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#A5B4FC",
        borderRadius: 14,
        paddingHorizontal: 28,
        paddingVertical: 13,
        marginTop: 6,
    },
    permBtnText: {
        color: "#020617",
        fontWeight: "900",
        fontSize: 15,
    },
    permCancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    permCancelText: {
        color: "rgba(255,255,255,0.50)",
        fontWeight: "700",
        fontSize: 14,
    },

    // ── Viewfinder overlay ──
    scrimTop: {
        height: "20%",
        backgroundColor: SCRIM,
    },
    scrimMiddleRow: {
        flexDirection: "row",
        height: FRAME_H,
    },
    scrimSide: {
        flex: 1,
        backgroundColor: SCRIM,
    },
    frameWindow: {
        width: FRAME_W,
        height: FRAME_H,
        borderRadius: 10,
        overflow: "visible",
    },
    scrimBottom: {
        flex: 1,
        backgroundColor: SCRIM,
    },

    // Corner bracket markers
    corner: {
        position: "absolute",
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: CORNER_COLOR,
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderTopLeftRadius: CORNER_RADIUS,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderTopRightRadius: CORNER_RADIUS,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderLeftWidth: CORNER_THICKNESS,
        borderBottomLeftRadius: CORNER_RADIUS,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: CORNER_THICKNESS,
        borderRightWidth: CORNER_THICKNESS,
        borderBottomRightRadius: CORNER_RADIUS,
    },

    // ── Top / bottom bars ──
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.40)",
        alignItems: "center",
        justifyContent: "center",
    },
    scanHint: {
        color: "rgba(255,255,255,0.80)",
        fontWeight: "700",
        fontSize: 13,
        textAlign: "center",
        flex: 1,
    },
    bottomBar: {
        flex: 1,
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 28,
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(255,255,255,0.25)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "#fff",
    },
    captureBtnInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#fff",
    },

    // ── Preview screen ──
    previewImage: {
        flex: 1,
        width: "100%",
        height: "100%",
        backgroundColor: "#020617",
    },
    previewTopBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
        backgroundColor: "rgba(2,6,23,0.55)",
    },
    previewTitle: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 16,
        flex: 1,
        textAlign: "center",
    },
    previewBottomBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        paddingHorizontal: 20,
        paddingVertical: 18,
        backgroundColor: "rgba(2,6,23,0.70)",
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
    },
    retakeBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.40)",
        borderRadius: 14,
        paddingHorizontal: 20,
        paddingVertical: 13,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    retakeBtnText: {
        color: "#fff",
        fontWeight: "800",
        fontSize: 15,
    },
    usePhotoBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#A5B4FC",
        borderRadius: 14,
        paddingHorizontal: 20,
        paddingVertical: 13,
    },
    usePhotoBtnText: {
        color: "#020617",
        fontWeight: "900",
        fontSize: 15,
    },
});
