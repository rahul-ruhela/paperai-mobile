import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";

import GradientScreen from "../ui/GradientScreen";
import ConfirmActionSheet from "../ui/ConfirmActionSheet";
import CreditConfirmModal from "../ui/CreditConfirmModal";
import { reserveCredits, completeTransaction, refundTransaction, getFeatureConfig } from "../api/credits";

const SCAN_MESSAGES = [
    "Preparing safe scan…",
    "Loading your photos…",
    "Comparing file sizes…",
    "Comparing creation dates…",
    "Finding duplicate groups…",
    "Preparing cleanup report…",
];
const SCAN_DURATION_MS = 5000;
const PAGE_SIZE = 500; // assets per MediaLibrary page

export default function JunkWiperScanScreen({ navigation }) {
    const [phase, setPhase] = useState("idle");
    const [messageIdx, setMessageIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [stats, setStats] = useState({ photos: 0, groups: 0, savedMB: 0 });
    const [duplicates, setDuplicates] = useState([]);   // [{ id, label, saveMB, count, assetIds }]
    const [selected, setSelected] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [txnId, setTxnId] = useState(null);
    const txnIdRef = useRef(null); // keep in sync for use inside intervals

    const [confirmModal, setConfirmModal] = useState({ visible: false, loading: false });
    const [featureCfg, setFeatureCfg] = useState({
        creditCost: 30,
        userNoticeTitle: "Start Duplicate Scan",
        userNoticeMessage: "Junk Wiper will scan only the photos and files you allow. This duplicate scan report will use 30 credits. Nothing will be deleted automatically. You will review and confirm before removing anything.",
    });

    // Animations
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    const ring3 = useRef(new Animated.Value(0)).current;
    const scanLine = useRef(new Animated.Value(0)).current;
    const glowOpacity = useRef(new Animated.Value(0.4)).current;
    const iconBounce = useRef(new Animated.Value(1)).current;
    const msgInterval = useRef(null);
    const progInterval = useRef(null);

    useEffect(() => {
        getFeatureConfig("junk_wiper_scan_report")
            .then(cfg => { if (cfg) setFeatureCfg(cfg); })
            .catch(() => {});
        return () => stopAnimations();
    }, []);

    function startAnimations() {
        Animated.loop(Animated.timing(ring1, { toValue: 1, duration: 3200, useNativeDriver: true, easing: Easing.linear })).start();
        Animated.loop(Animated.timing(ring2, { toValue: 1, duration: 5000, useNativeDriver: true, easing: Easing.linear })).start();
        Animated.loop(Animated.timing(ring3, { toValue: 1, duration: 7500, useNativeDriver: true, easing: Easing.linear })).start();
        Animated.loop(Animated.sequence([
            Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            Animated.timing(scanLine, { toValue: 0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ])).start();
        Animated.loop(Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.85, duration: 1200, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ])).start();
        Animated.loop(Animated.sequence([
            Animated.timing(iconBounce, { toValue: 1.12, duration: 900, useNativeDriver: true }),
            Animated.timing(iconBounce, { toValue: 1.0, duration: 900, useNativeDriver: true }),
        ])).start();
    }

    function stopAnimations() {
        ring1.stopAnimation(); ring2.stopAnimation(); ring3.stopAnimation();
        scanLine.stopAnimation(); glowOpacity.stopAnimation(); iconBounce.stopAnimation();
        if (msgInterval.current) clearInterval(msgInterval.current);
        if (progInterval.current) clearInterval(progInterval.current);
    }

    // ── Step 1: Permission check (free) ────────────────────────────────────────
    async function requestScan() {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
            Alert.alert(
                "Permission Required",
                "Photo library permission is required to scan for duplicates. Nothing will be deleted without your confirmation.",
                [{ text: "OK" }]
            );
            return;
        }
        setConfirmModal({ visible: true, loading: false });
    }

    // ── Step 2: User confirmed credit use → reserve → scan ────────────────────
    async function startScan() {
        setConfirmModal(m => ({ ...m, loading: true }));
        try {
            const reservation = await reserveCredits("junk_wiper_scan_report", null, 0);
            txnIdRef.current = reservation.transactionId;
            setTxnId(reservation.transactionId);
            setConfirmModal({ visible: false, loading: false });
        } catch (e) {
            setConfirmModal({ visible: false, loading: false });
            if (e?.response?.status === 402) {
                const p = e.response?.data;
                Alert.alert("Not Enough Credits",
                    `You need ${p?.requiredCredits ?? featureCfg.creditCost} credits but have ${p?.credits ?? 0}.\n\nPlease top up and try again.`);
            } else {
                Alert.alert("Could Not Start Scan",
                    "There was a problem starting the scan. Please check your connection and try again.");
            }
            return;
        }

        setPhase("scanning");
        setProgress(0);
        setMessageIdx(0);
        startAnimations();

        // Cycle messages during scan
        let msgI = 0;
        msgInterval.current = setInterval(() => {
            msgI = (msgI + 1) % SCAN_MESSAGES.length;
            setMessageIdx(msgI);
        }, SCAN_DURATION_MS / SCAN_MESSAGES.length);

        // Animate progress bar while real scan runs in background
        const startTime = Date.now();
        progInterval.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pct = Math.min(95, Math.round((elapsed / SCAN_DURATION_MS) * 95));
            setProgress(pct);
        }, 80);

        // Run real duplicate detection
        try {
            const groups = await findDuplicates((scannedCount) => {
                setStats(s => ({ ...s, photos: scannedCount }));
            });
            clearInterval(progInterval.current);
            clearInterval(msgInterval.current);
            setProgress(100);
            stopAnimations();

            const totalBytes = groups.reduce((acc, g) => acc + g.totalBytes, 0);
            setStats({
                photos: groups.reduce((acc, g) => acc + g.count, 0),
                groups: groups.length,
                savedMB: parseFloat((totalBytes / 1024 / 1024).toFixed(1)),
            });
            setDuplicates(groups);

            // Complete credit transaction — report delivered
            if (txnIdRef.current) {
                await completeTransaction(txnIdRef.current).catch(() => {});
                txnIdRef.current = null;
                setTxnId(null);
            }
            setPhase("done");
        } catch (err) {
            clearInterval(progInterval.current);
            clearInterval(msgInterval.current);
            stopAnimations();
            // Refund if scan itself failed
            if (txnIdRef.current) {
                await refundTransaction(txnIdRef.current, err.message).catch(() => {});
                txnIdRef.current = null;
                setTxnId(null);
            }
            Alert.alert("Scan Failed", err.message || "Could not complete scan. Your credits have been refunded.");
            setPhase("idle");
        }
    }

    async function cancelScan() {
        stopAnimations();
        if (txnIdRef.current) {
            await refundTransaction(txnIdRef.current, "User cancelled scan").catch(() => {});
            txnIdRef.current = null;
            setTxnId(null);
        }
        setPhase("idle");
        setProgress(0);
    }

    // ── Real duplicate detection via MediaLibrary ─────────────────────────────
    async function findDuplicates(onProgress) {
        // Load all photos in pages
        let assets = [];
        let after = undefined;
        let hasMore = true;
        while (hasMore) {
            const page = await MediaLibrary.getAssetsAsync({
                mediaType: MediaLibrary.MediaType.photo,
                first: PAGE_SIZE,
                after,
                sortBy: MediaLibrary.SortBy.creationTime,
            });
            assets = assets.concat(page.assets);
            hasMore = page.hasNextPage;
            after = page.endCursor;
            onProgress(assets.length);
        }

        // Group by filename + file size to find duplicates
        // MediaLibrary assets have: id, filename, fileSize, duration, width, height, creationTime
        const buckets = {};
        for (const asset of assets) {
            const key = `${asset.filename}__${asset.width}x${asset.height}`;
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(asset);
        }

        // Build duplicate groups — only buckets with >1 item
        const groups = [];
        for (const [key, items] of Object.entries(buckets)) {
            if (items.length < 2) continue;
            // Keep newest, mark rest as duplicates
            const sorted = [...items].sort((a, b) => b.creationTime - a.creationTime);
            const dupeAssets = sorted.slice(1); // all except newest
            const totalBytes = dupeAssets.reduce((acc, a) => acc + (a.fileSize || 0), 0);
            const fname = items[0].filename;
            groups.push({
                id: key,
                label: `${fname} (${items.length} copies)`,
                count: dupeAssets.length,
                totalBytes,
                saveMB: parseFloat((totalBytes / 1024 / 1024).toFixed(1)),
                assetIds: dupeAssets.map(a => a.id), // IDs to delete (keep newest)
            });
        }

        // Sort by most savings first
        return groups.sort((a, b) => b.totalBytes - a.totalBytes);
    }

    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function selectAll() {
        setSelected(new Set(duplicates.map(d => d.id)));
    }

    // ── Delete selected groups ────────────────────────────────────────────────
    async function deleteSelected() {
        setDeleting(true);
        setDeleteConfirm(false);
        try {
            // Collect all asset IDs from selected groups
            const assetIds = duplicates
                .filter(d => selected.has(d.id))
                .flatMap(d => d.assetIds);

            if (assetIds.length > 0) {
                await MediaLibrary.deleteAssetsAsync(assetIds);
            }

            setDuplicates(prev => prev.filter(d => !selected.has(d.id)));
            setSelected(new Set());

            // If all groups cleared, show success
            const remaining = duplicates.filter(d => !selected.has(d.id));
            if (remaining.length === 0) {
                Alert.alert("All Done!", "All selected duplicates have been removed.");
            }
        } catch (err) {
            Alert.alert("Delete Failed", err.message || "Could not delete some items. Please try again.");
        } finally {
            setDeleting(false);
        }
    }

    const ring1Rotate = ring1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const ring2Rotate = ring2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
    const ring3Rotate = ring3.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const scanLineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                    <View style={styles.header}>
                        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={20} color="#A5B4FC" />
                        </Pressable>
                        <Text style={styles.headerTitle}>Junk Wiper</Text>
                        <View style={{ width: 36 }} />
                    </View>

                    <Text style={styles.complianceNote}>
                        Smart Duplicate Cleaner — scans only your permitted photos.{"\n"}Nothing is deleted automatically.
                    </Text>

                    {/* ── Idle ── */}
                    {phase === "idle" && (
                        <View style={styles.idleBox}>
                            <View style={styles.idleIcon}>
                                <Ionicons name="search-outline" size={40} color="#A5B4FC" />
                            </View>
                            <Text style={styles.idleTitle}>Ready to Scan</Text>
                            <Text style={styles.idleBody}>
                                Junk Wiper scans your permitted photos for exact and near-duplicate files.
                                You review and choose what to remove.
                            </Text>
                            <Pressable style={styles.startBtn} onPress={requestScan}>
                                <Ionicons name="play-circle-outline" size={20} color="#fff" />
                                <Text style={styles.startBtnText}>Start Duplicate Scan · {featureCfg.creditCost} credits</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ── Scanning ── */}
                    {phase === "scanning" && (
                        <View style={styles.scannerBox}>
                            <View style={styles.ringContainer}>
                                <Animated.View style={[styles.ring, styles.ring3, { transform: [{ rotate: ring3Rotate }] }]} />
                                <Animated.View style={[styles.ring, styles.ring2, { transform: [{ rotate: ring2Rotate }] }]} />
                                <Animated.View style={[styles.ring, styles.ring1, { transform: [{ rotate: ring1Rotate }] }]} />
                                <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
                                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
                                <Animated.View style={[styles.centerIcon, { transform: [{ scale: iconBounce }] }]}>
                                    <Ionicons name="search" size={34} color="#A5B4FC" />
                                </Animated.View>
                            </View>

                            <Text style={styles.progressPct}>{progress}%</Text>
                            <Text style={styles.scanMessage}>{SCAN_MESSAGES[messageIdx]}</Text>

                            <View style={styles.countersRow}>
                                <Counter label="Photos found" value={stats.photos} />
                            </View>

                            <View style={styles.safetyRow}>
                                <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                                <Text style={styles.safetyText}>Nothing will be deleted without your confirmation.</Text>
                            </View>

                            <Pressable style={styles.cancelScanBtn} onPress={cancelScan}>
                                <Text style={styles.cancelScanText}>Cancel Scan</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ── Done / Report ── */}
                    {phase === "done" && (
                        <View style={styles.reportBox}>
                            <View style={styles.reportHeader}>
                                <Ionicons name="checkmark-circle" size={28} color="#34D399" />
                                <Text style={styles.reportTitle}>Scan Complete</Text>
                            </View>

                            <View style={styles.statsGrid}>
                                <StatBox label="Duplicates found" value={stats.photos} icon="images-outline" />
                                <StatBox label="Groups" value={stats.groups} icon="copy-outline" />
                                <StatBox label="Possible savings" value={`${stats.savedMB} MB`} icon="server-outline" />
                            </View>

                            {duplicates.length === 0 ? (
                                <View style={styles.noDupBox}>
                                    <Ionicons name="checkmark-circle-outline" size={36} color="#34D399" />
                                    <Text style={styles.noDupText}>No duplicates found!</Text>
                                    <Text style={styles.noDupSub}>Your photo library looks clean.</Text>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.reportSubRow}>
                                        <Text style={styles.reportSubtitle}>
                                            Select groups to remove · keeping the newest copy
                                        </Text>
                                        <Pressable onPress={selectAll}>
                                            <Text style={styles.selectAllText}>Select All</Text>
                                        </Pressable>
                                    </View>

                                    {duplicates.map(item => (
                                        <Pressable
                                            key={item.id}
                                            style={[styles.dupItem, selected.has(item.id) && styles.dupItemSelected]}
                                            onPress={() => toggleSelect(item.id)}
                                        >
                                            <View style={[styles.dupCheck, selected.has(item.id) && styles.dupCheckActive]}>
                                                {selected.has(item.id) && <Ionicons name="checkmark" size={13} color="#fff" />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.dupLabel} numberOfLines={1}>{item.label}</Text>
                                                <Text style={styles.dupMeta}>
                                                    {item.count} duplicate{item.count > 1 ? "s" : ""} · saves ~{item.saveMB} MB
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name="trash-bin-outline" size={16}
                                                color={selected.has(item.id) ? "#F87171" : "rgba(255,255,255,0.3)"}
                                            />
                                        </Pressable>
                                    ))}

                                    {selected.size > 0 && (
                                        <Pressable
                                            style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                                            onPress={() => setDeleteConfirm(true)}
                                            disabled={deleting}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#fff" />
                                            <Text style={styles.deleteBtnText}>
                                                Delete {selected.size} selected {selected.size === 1 ? "group" : "groups"}
                                            </Text>
                                        </Pressable>
                                    )}
                                </>
                            )}

                            <View style={styles.safetyRow}>
                                <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                                <Text style={styles.safetyText}>Nothing will be deleted without your confirmation.</Text>
                            </View>

                            <Pressable style={styles.rescanBtn} onPress={() => { setPhase("idle"); setDuplicates([]); setSelected(new Set()); }}>
                                <Text style={styles.rescanText}>Scan Again</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            <ConfirmActionSheet
                visible={deleteConfirm}
                title="Confirm Delete"
                message={`You selected ${selected.size} duplicate ${selected.size === 1 ? "group" : "groups"} to remove. The newest copy of each file will be kept. This action cannot be undone.`}
                confirmText={`Delete ${selected.size} Selected`}
                cancelText="Cancel"
                destructive
                icon="trash-outline"
                onConfirm={deleteSelected}
                onCancel={() => setDeleteConfirm(false)}
            />

            <CreditConfirmModal
                visible={confirmModal.visible}
                title={featureCfg.userNoticeTitle}
                message={featureCfg.userNoticeMessage}
                creditCost={featureCfg.creditCost}
                confirmText={`Start Scan · Use ${featureCfg.creditCost} Credits`}
                loading={confirmModal.loading}
                onConfirm={startScan}
                onCancel={() => setConfirmModal({ visible: false, loading: false })}
                safetyNote="Nothing will be deleted without your confirmation."
            />
        </GradientScreen>
    );
}

function Counter({ label, value }) {
    return (
        <View style={styles.counter}>
            <Text style={styles.counterValue}>{value}</Text>
            <Text style={styles.counterLabel}>{label}</Text>
        </View>
    );
}

function StatBox({ label, value, icon }) {
    return (
        <View style={styles.statBox}>
            <Ionicons name={icon} size={18} color="#A5B4FC" />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 16, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    complianceNote: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 17 },

    idleBox: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22, padding: 22, gap: 14, alignItems: "center",
    },
    idleIcon: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: "rgba(99,102,241,0.15)",
        borderWidth: 1, borderColor: "rgba(165,180,252,0.25)",
        alignItems: "center", justifyContent: "center",
    },
    idleTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    idleBody: { color: "rgba(255,255,255,0.65)", fontWeight: "700", textAlign: "center", lineHeight: 20 },
    startBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(99,102,241,0.80)",
        borderRadius: 18, paddingVertical: 14, paddingHorizontal: 22,
        borderWidth: 1, borderColor: "rgba(165,180,252,0.35)",
    },
    startBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    scannerBox: { alignItems: "center", gap: 18 },
    ringContainer: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
    ring: { position: "absolute", borderRadius: 999, borderStyle: "dashed" },
    ring1: { width: 140, height: 140, borderWidth: 2, borderColor: "rgba(165,180,252,0.55)" },
    ring2: { width: 170, height: 170, borderWidth: 1.5, borderColor: "rgba(99,102,241,0.35)" },
    ring3: { width: 200, height: 200, borderWidth: 1, borderColor: "rgba(165,180,252,0.18)" },
    glow: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(99,102,241,0.25)" },
    scanLine: { position: "absolute", width: 130, height: 2, backgroundColor: "rgba(165,180,252,0.70)", borderRadius: 1 },
    centerIcon: {
        width: 72, height: 72, borderRadius: 24,
        backgroundColor: "rgba(13,20,38,0.92)",
        borderWidth: 1, borderColor: "rgba(165,180,252,0.35)",
        alignItems: "center", justifyContent: "center",
    },
    progressPct: { color: "#fff", fontSize: 32, fontWeight: "900" },
    scanMessage: { color: "#A5B4FC", fontWeight: "800", fontSize: 15, textAlign: "center" },
    countersRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
    counter: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 14, padding: 10, alignItems: "center", minWidth: 90,
    },
    counterValue: { color: "#fff", fontWeight: "900", fontSize: 18 },
    counterLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textAlign: "center" },
    safetyRow: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "rgba(52,211,153,0.07)",
        borderWidth: 1, borderColor: "rgba(52,211,153,0.18)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    safetyText: { flex: 1, color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: "700", lineHeight: 17 },
    cancelScanBtn: {
        paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    },
    cancelScanText: { color: "rgba(255,255,255,0.70)", fontWeight: "800" },

    reportBox: { gap: 14 },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reportTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    statsGrid: { flexDirection: "row", gap: 10 },
    statBox: {
        flex: 1, backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
    },
    statValue: { color: "#fff", fontWeight: "900", fontSize: 18 },
    statLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700", textAlign: "center" },
    reportSubRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    reportSubtitle: { color: "rgba(255,255,255,0.60)", fontWeight: "700", fontSize: 13, flex: 1 },
    selectAllText: { color: "#A5B4FC", fontWeight: "800", fontSize: 13 },

    noDupBox: { alignItems: "center", gap: 8, paddingVertical: 20 },
    noDupText: { color: "#34D399", fontWeight: "900", fontSize: 18 },
    noDupSub: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 14 },

    dupItem: {
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 16, padding: 14,
    },
    dupItemSelected: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.35)" },
    dupCheck: {
        width: 22, height: 22, borderRadius: 8,
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.30)",
        alignItems: "center", justifyContent: "center",
    },
    dupCheckActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
    dupLabel: { color: "#fff", fontWeight: "800", fontSize: 13 },
    dupMeta: { color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 12, marginTop: 2 },

    deleteBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: "rgba(239,68,68,0.85)",
        borderRadius: 18, paddingVertical: 14,
        borderWidth: 1, borderColor: "rgba(239,68,68,0.30)",
    },
    deleteBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
    rescanBtn: {
        alignItems: "center", paddingVertical: 12,
        borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    },
    rescanText: { color: "rgba(255,255,255,0.70)", fontWeight: "800" },
});
