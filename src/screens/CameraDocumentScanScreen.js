import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { API } from "../constants/api";

// ── Upload helper (only used by the optional paid "Analyze with AI" action) ───
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

// Build a multi-page PDF from captured page base64 JPEGs. Free — fully on-device.
async function buildPdf(pages) {
    const imgs = pages
        .map(
            (p) =>
                `<div style="page-break-after:always;text-align:center;">
                    <img src="data:image/jpeg;base64,${p.base64}" style="width:100%;max-height:100%;object-fit:contain;" />
                 </div>`
        )
        .join("");
    const html = `<html><body style="margin:0;padding:0;">${imgs}</body></html>`;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CameraDocumentScanScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [pages, setPages] = useState([]);        // [{ uri, base64 }]
    const [showCamera, setShowCamera] = useState(true); // camera vs review
    const [cameraReady, setCameraReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [busy, setBusy] = useState(false);       // save / export / analyze in flight
    const cameraRef = useRef(null);

    // ── Permission gates ───────────────────────────────────────────────────────
    if (!permission) {
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
                    <Pressable style={styles.permCancelBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.permCancelText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // ── Capture ────────────────────────────────────────────────────────────────
    async function handleCapture() {
        // FIX: guard against firing before the camera is ready or while a previous
        // shot is still in flight — takePictureAsync rejects on an unready/busy
        // camera, which is the root cause of the scanner "not working".
        if (!cameraRef.current || !cameraReady || capturing) return;
        try {
            setCapturing(true);
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true, // needed to build the PDF fully on-device
            });
            if (!photo?.uri) throw new Error("Camera returned no image.");
            setPages((prev) => [...prev, { uri: photo.uri, base64: photo.base64 }]);
        } catch (err) {
            Alert.alert("Capture failed", err?.message || "Could not take photo. Please try again.");
        } finally {
            setCapturing(false);
        }
    }

    function removePage(index) {
        setPages((prev) => prev.filter((_, i) => i !== index));
    }

    function openCameraForMore() {
        setCameraReady(false);
        setShowCamera(true);
    }

    // ── FREE: Save all pages to Photos ─────────────────────────────────────────
    async function handleSaveToPhotos() {
        if (!pages.length || busy) return;
        try {
            setBusy(true);
            const perm = await MediaLibrary.requestPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(
                    "Photo Access Needed",
                    "Allow photo access so scanned pages can be saved to your library.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => Linking.openSettings() },
                    ]
                );
                return;
            }
            for (const p of pages) await MediaLibrary.saveToLibraryAsync(p.uri);
            Alert.alert("Saved", `${pages.length} page${pages.length > 1 ? "s" : ""} saved to your Photos.`);
        } catch (err) {
            Alert.alert("Save failed", err?.message || "Could not save the scan. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    // ── FREE: Export / share as PDF ────────────────────────────────────────────
    async function handleExportPdf() {
        if (!pages.length || busy) return;
        try {
            setBusy(true);
            const pdfUri = await buildPdf(pages);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(pdfUri, {
                    mimeType: "application/pdf",
                    dialogTitle: "Share scanned document",
                    UTI: "com.adobe.pdf",
                });
            } else {
                Alert.alert("Exported", "PDF created, but sharing isn't available on this device.");
            }
        } catch (err) {
            Alert.alert("Export failed", err?.message || "Could not create the PDF. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    // ── PAID: Analyze the first page with AI — existing credits flow ──────────
    async function handleAnalyze() {
        if (!pages.length || busy) return;
        try {
            setBusy(true);
            const data = await uploadFile(pages[0].uri);
            navigation.navigate("Process", { docId: data.id, title: data.title });
        } catch (err) {
            Alert.alert("Upload failed", err?.message || "Could not upload the scan. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    // ── REVIEW MODE ────────────────────────────────────────────────────────────
    if (!showCamera && pages.length > 0) {
        return (
            <View style={styles.root}>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.reviewTopBar}>
                        <Pressable
                            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => navigation.goBack()}
                            disabled={busy}
                        >
                            <Ionicons name="close" size={22} color="#fff" />
                        </Pressable>
                        <Text style={styles.reviewTitle}>
                            {pages.length} page{pages.length > 1 ? "s" : ""} scanned
                        </Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <FlatList
                        data={pages}
                        keyExtractor={(_, i) => `page-${i}`}
                        numColumns={2}
                        contentContainerStyle={styles.pageGrid}
                        columnWrapperStyle={{ gap: 12 }}
                        renderItem={({ item, index }) => (
                            <View style={styles.pageThumbWrap}>
                                <Image source={{ uri: item.uri }} style={styles.pageThumb} resizeMode="cover" />
                                <View style={styles.pageBadge}>
                                    <Text style={styles.pageBadgeText}>{index + 1}</Text>
                                </View>
                                <Pressable
                                    style={styles.pageRemove}
                                    onPress={() => removePage(index)}
                                    disabled={busy}
                                    hitSlop={8}
                                >
                                    <Ionicons name="close-circle" size={22} color="#F87171" />
                                </Pressable>
                            </View>
                        )}
                        ListFooterComponent={
                            <Pressable
                                style={({ pressed }) => [styles.addPageTile, pressed && { opacity: 0.8 }]}
                                onPress={openCameraForMore}
                                disabled={busy}
                            >
                                <Ionicons name="add" size={26} color="#A5B4FC" />
                                <Text style={styles.addPageTileText}>Add Page</Text>
                            </Pressable>
                        }
                    />
                </SafeAreaView>

                {/* Free actions */}
                <View style={styles.reviewBottomBar}>
                    <Pressable
                        style={({ pressed }) => [styles.barBtn, pressed && { opacity: 0.8 }, busy && { opacity: 0.5 }]}
                        onPress={handleSaveToPhotos}
                        disabled={busy}
                    >
                        <Ionicons name="download-outline" size={20} color="#fff" />
                        <Text style={styles.barBtnText}>Save to Photos</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.barBtnPrimary, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
                        onPress={handleExportPdf}
                        disabled={busy}
                    >
                        {busy ? (
                            <ActivityIndicator size="small" color="#020617" />
                        ) : (
                            <>
                                <Ionicons name="share-outline" size={20} color="#020617" />
                                <Text style={styles.barBtnPrimaryText}>Export PDF</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                {/* Optional paid AI analyze */}
                <Pressable
                    style={({ pressed }) => [styles.analyzeLink, pressed && { opacity: 0.75 }]}
                    onPress={handleAnalyze}
                    disabled={busy}
                >
                    <Ionicons name="sparkles-outline" size={15} color="#A5B4FC" />
                    <Text style={styles.analyzeLinkText}>Analyze with AI (uses credits)</Text>
                </Pressable>
            </View>
        );
    }

    // ── CAMERA MODE ────────────────────────────────────────────────────────────
    return (
        <View style={styles.root}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
            />

            {/* Document frame overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={styles.scrimTop} />
                <View style={styles.scrimMiddleRow}>
                    <View style={styles.scrimSide} />
                    <View style={styles.frameWindow}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <View style={styles.scrimSide} />
                </View>
                <View style={styles.scrimBottom} />
            </View>

            {/* Controls */}
            <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <View style={styles.topBar}>
                    <Pressable
                        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => (pages.length > 0 ? setShowCamera(false) : navigation.goBack())}
                    >
                        <Ionicons name={pages.length > 0 ? "arrow-back" : "close"} size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.scanHint}>Position document inside the frame</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.bottomBar}>
                    {!cameraReady && <Text style={styles.readyHint}>Starting camera…</Text>}

                    <View style={styles.captureRow}>
                        {/* Left: page count / done */}
                        <Pressable
                            style={[styles.doneChip, pages.length === 0 && { opacity: 0 }]}
                            onPress={() => setShowCamera(false)}
                            disabled={pages.length === 0}
                            hitSlop={10}
                        >
                            <Ionicons name="checkmark" size={16} color="#020617" />
                            <Text style={styles.doneChipText}>Done · {pages.length}</Text>
                        </Pressable>

                        {/* Center: shutter */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.captureBtn,
                                pressed && { transform: [{ scale: 0.94 }] },
                                (!cameraReady || capturing) && { opacity: 0.5 },
                            ]}
                            onPress={handleCapture}
                            disabled={!cameraReady || capturing}
                            accessibilityLabel="Capture document"
                            accessibilityRole="button"
                        >
                            {capturing ? (
                                <ActivityIndicator size="small" color="#020617" />
                            ) : (
                                <View style={styles.captureBtnInner} />
                            )}
                        </Pressable>

                        {/* Right spacer to balance the shutter */}
                        <View style={styles.doneChipSpacer} />
                    </View>

                    <Text style={styles.freeHint}>Free · scan &amp; save unlimited pages</Text>
                </View>
            </SafeAreaView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const FRAME_W = 280;
const FRAME_H = 360;
const SCRIM = "rgba(2,6,23,0.60)";
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#fff";
const CORNER_RADIUS = 5;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#020617" },

    // Permission screen
    centeredContainer: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
    permissionBox: { alignItems: "center", paddingHorizontal: 32, gap: 14 },
    permissionTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 8 },
    permissionSubtitle: { color: "rgba(255,255,255,0.60)", fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20 },
    permBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#A5B4FC", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginTop: 6 },
    permBtnText: { color: "#020617", fontWeight: "900", fontSize: 15 },
    permCancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
    permCancelText: { color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 14 },

    // Viewfinder overlay
    scrimTop: { height: "16%", backgroundColor: SCRIM },
    scrimMiddleRow: { flexDirection: "row", height: FRAME_H },
    scrimSide: { flex: 1, backgroundColor: SCRIM },
    frameWindow: { width: FRAME_W, height: FRAME_H, borderRadius: 10, overflow: "visible" },
    scrimBottom: { flex: 1, backgroundColor: SCRIM },
    corner: { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: CORNER_COLOR },
    cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: CORNER_RADIUS },
    cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: CORNER_RADIUS },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: CORNER_RADIUS },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: CORNER_RADIUS },

    // Top / bottom bars
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.40)", alignItems: "center", justifyContent: "center" },
    scanHint: { color: "rgba(255,255,255,0.80)", fontWeight: "700", fontSize: 13, textAlign: "center", flex: 1 },
    bottomBar: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 28, gap: 10 },
    readyHint: { color: "rgba(255,255,255,0.70)", fontWeight: "700", fontSize: 12 },
    freeHint: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 },
    captureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 24 },
    captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
    captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" },
    doneChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#A5B4FC", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    doneChipText: { color: "#020617", fontWeight: "900", fontSize: 13 },
    doneChipSpacer: { width: 92 },

    // Review screen
    reviewTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
    reviewTitle: { color: "#fff", fontWeight: "900", fontSize: 16, flex: 1, textAlign: "center" },
    pageGrid: { padding: 16, gap: 12 },
    pageThumbWrap: { flex: 1, aspectRatio: 0.72, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
    pageThumb: { width: "100%", height: "100%" },
    pageBadge: { position: "absolute", top: 8, left: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(2,6,23,0.75)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    pageBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
    pageRemove: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(2,6,23,0.6)", borderRadius: 12 },
    addPageTile: { marginTop: 12, height: 70, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(165,180,252,0.4)", alignItems: "center", justifyContent: "center", gap: 2, flexDirection: "row" },
    addPageTileText: { color: "#A5B4FC", fontWeight: "800", fontSize: 14, marginLeft: 4 },

    reviewBottomBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: "rgba(2,6,23,0.85)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
    barBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)", borderRadius: 14, paddingVertical: 13, backgroundColor: "rgba(255,255,255,0.06)" },
    barBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    barBtnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#A5B4FC", borderRadius: 14, paddingVertical: 13 },
    barBtnPrimaryText: { color: "#020617", fontWeight: "900", fontSize: 14 },
    analyzeLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingBottom: 20, backgroundColor: "rgba(2,6,23,0.85)" },
    analyzeLinkText: { color: "#A5B4FC", fontWeight: "800", fontSize: 13 },
});
