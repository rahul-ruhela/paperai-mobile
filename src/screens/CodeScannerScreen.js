import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Clipboard,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";

// General-purpose code scanner — QR, barcodes, and other common symbologies.
// Free for every user; needs only the camera (no server call, no credits).
const BARCODE_TYPES = [
    "qr", "ean13", "ean8", "upc_a", "upc_e", "code39", "code93", "code128",
    "codabar", "itf14", "pdf417", "aztec", "datamatrix",
];

function looksLikeUrl(value) {
    return /^(https?:\/\/|www\.)\S+$/i.test(value.trim());
}

function normalizeUrl(value) {
    const v = value.trim();
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export default function CodeScannerScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [result, setResult] = useState(null); // { type, data }
    const lockRef = useRef(false); // debounce repeated scans of the same frame

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
                    <Ionicons name="qr-code-outline" size={52} color="#A5B4FC" />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionSubtitle}>
                        Paper AI needs camera access to scan QR codes and barcodes.
                    </Text>
                    {canAsk ? (
                        <Pressable style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.75 }]} onPress={requestPermission}>
                            <Text style={styles.permBtnText}>Grant Permission</Text>
                        </Pressable>
                    ) : (
                        <Pressable style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.75 }]} onPress={() => Linking.openSettings()}>
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

    function handleScanned({ type, data }) {
        if (lockRef.current || !data) return;
        lockRef.current = true; // stop the stream of duplicate callbacks
        setResult({ type, data });
    }

    function scanAgain() {
        setResult(null);
        lockRef.current = false;
    }

    function copyValue() {
        if (!result) return;
        Clipboard.setString(result.data);
    }

    async function openValue() {
        if (!result) return;
        try {
            await Linking.openURL(normalizeUrl(result.data));
        } catch {
            /* nothing can handle it — ignore */
        }
    }

    const isUrl = result ? looksLikeUrl(result.data) : false;

    return (
        <View style={styles.root}>
            {/* Camera only runs while there's no result, to save power */}
            {!result && (
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                    onBarcodeScanned={handleScanned}
                />
            )}

            {/* Scan window overlay */}
            {!result && (
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
            )}

            <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <View style={styles.topBar}>
                    <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>
                    <Text style={styles.title}>Scan QR &amp; Codes</Text>
                    <View style={{ width: 44 }} />
                </View>

                {!result ? (
                    <View style={styles.hintWrap}>
                        <Text style={styles.hint}>Point your camera at a QR code or barcode</Text>
                    </View>
                ) : (
                    <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="checkmark-circle" size={22} color="#34D399" />
                            <Text style={styles.resultType}>{String(result.type || "code").toUpperCase()}</Text>
                        </View>

                        <View style={styles.valueBox}>
                            <Text style={styles.valueText} selectable>{result.data}</Text>
                        </View>

                        <View style={styles.actionRow}>
                            <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]} onPress={copyValue}>
                                <Ionicons name="copy-outline" size={18} color="#A5B4FC" />
                                <Text style={styles.actionText}>Copy</Text>
                            </Pressable>
                            {isUrl && (
                                <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]} onPress={openValue}>
                                    <Ionicons name="open-outline" size={18} color="#A5B4FC" />
                                    <Text style={styles.actionText}>Open Link</Text>
                                </Pressable>
                            )}
                        </View>

                        <Pressable style={({ pressed }) => [styles.scanAgainBtn, pressed && { opacity: 0.85 }]} onPress={scanAgain}>
                            <Ionicons name="scan-outline" size={18} color="#020617" />
                            <Text style={styles.scanAgainText}>Scan Another</Text>
                        </Pressable>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const FRAME = 250;
const SCRIM = "rgba(2,6,23,0.60)";
const C_SIZE = 26, C_THICK = 3, C_COLOR = "#A5B4FC", C_RAD = 6;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#020617" },

    centeredContainer: { flex: 1, backgroundColor: "#020617", alignItems: "center", justifyContent: "center" },
    permissionBox: { alignItems: "center", paddingHorizontal: 32, gap: 14 },
    permissionTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 8 },
    permissionSubtitle: { color: "rgba(255,255,255,0.60)", fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20 },
    permBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#A5B4FC", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginTop: 6 },
    permBtnText: { color: "#020617", fontWeight: "900", fontSize: 15 },
    permCancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
    permCancelText: { color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 14 },

    scrimTop: { flex: 1, backgroundColor: SCRIM },
    scrimMiddleRow: { flexDirection: "row", height: FRAME },
    scrimSide: { flex: 1, backgroundColor: SCRIM },
    frameWindow: { width: FRAME, height: FRAME, borderRadius: 12 },
    scrimBottom: { flex: 1.4, backgroundColor: SCRIM },
    corner: { position: "absolute", width: C_SIZE, height: C_SIZE, borderColor: C_COLOR },
    cornerTL: { top: 0, left: 0, borderTopWidth: C_THICK, borderLeftWidth: C_THICK, borderTopLeftRadius: C_RAD },
    cornerTR: { top: 0, right: 0, borderTopWidth: C_THICK, borderRightWidth: C_THICK, borderTopRightRadius: C_RAD },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: C_THICK, borderLeftWidth: C_THICK, borderBottomLeftRadius: C_RAD },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: C_THICK, borderRightWidth: C_THICK, borderBottomRightRadius: C_RAD },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.40)", alignItems: "center", justifyContent: "center" },
    title: { color: "#fff", fontWeight: "900", fontSize: 16, flex: 1, textAlign: "center" },

    hintWrap: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 60 },
    hint: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 14, textAlign: "center", backgroundColor: "rgba(2,6,23,0.5)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },

    resultCard: {
        marginTop: "auto", margin: 16, padding: 18, gap: 14,
        backgroundColor: "rgba(13,20,38,0.98)", borderRadius: 22,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    },
    resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    resultType: { color: "#34D399", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
    valueBox: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 14, padding: 14 },
    valueText: { color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 21 },
    actionRow: { flexDirection: "row", gap: 10 },
    actionBtn: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
        borderWidth: 1, borderColor: "rgba(165,180,252,0.35)", borderRadius: 14,
        paddingVertical: 12, backgroundColor: "rgba(165,180,252,0.10)",
    },
    actionText: { color: "#A5B4FC", fontWeight: "800", fontSize: 14 },
    scanAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#A5B4FC", borderRadius: 16, paddingVertical: 14 },
    scanAgainText: { color: "#020617", fontWeight: "900", fontSize: 15 },
});
