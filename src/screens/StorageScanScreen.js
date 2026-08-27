import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";

import GradientScreen from "../ui/GradientScreen";
import ConfirmActionSheet from "../ui/ConfirmActionSheet";
import CreditConfirmModal from "../ui/CreditConfirmModal";
import { PrimaryButton } from "../ui/buttons";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";
import { showEntitlementDenial } from "../ui/FeatureLock";

import {
    completeTransaction,
    getFeatureConfig,
    refundTransaction,
    reserveCredits,
} from "../api/credits";
import {
    ScanCancelled,
    bandLargeAssets,
    buildDuplicateGroups,
    classifySharpness,
    enrichAssets,
    enumerateAssets,
    findScreenshots,
    formatSize,
    groupSimilarByHash,
    isVideoAsset,
} from "../services/cleanerService";
import { sampleImage } from "../services/imageSampler";
import { freeDiskBytes, recordScan } from "../services/cleanerHistory";

/**
 * StorageScanScreen — one scan, review and delete flow shared by every Storage
 * Studio layer (roadmap Module 4, docs/smart-cleaner-spec.md §3).
 *
 * The four on-device layers differ only in which rows they produce, so they are
 * four MODES over one screen rather than four screens. Writing the review list
 * and the deletion path once is the point: those are where the rules in spec §7
 * live, and four copies of them would be four chances to get one wrong.
 *
 * The rules, restated because this file is where they are enforced:
 *
 *   • Nothing is selected by default. "Select all" exists; it still needs the
 *     confirm sheet, and the OS shows its own sheet on top of that.
 *   • Nothing is deleted automatically — not on completion, not on a timer.
 *   • A scan that finds nothing says so and refunds. A cancelled scan refunds.
 *   • The list is rebuilt from what the delete actually removed, never assumed.
 *
 * The paid modes (blurry, similar) do their image analysis entirely on the
 * device: one 64×64 greyscale downsample per photo, read for a sharpness score
 * and a 64-bit hash, then discarded. No image, thumbnail or hash is uploaded or
 * persisted. See services/imageSampler.js.
 */

// Bounded per spec §6 — a run over an unbounded library is how a scan becomes a
// battery complaint. Beyond this the user is told what was covered and can scan
// again rather than the app quietly analysing everything.
const SAMPLE_LIMIT = 2000;

const MODES = {
    screenshots: {
        title: "Screenshots",
        featureKey: "screenshot_cleaner",
        creditKey: null,
        icon: "phone-portrait-outline",
        blurb: "Every screenshot on this device, largest first. Runs on your device and uses no credits.",
        empty: "No screenshots found on this device.",
        noun: "screenshot",
    },
    large: {
        title: "Large Files",
        featureKey: "large_video_finder",
        creditKey: null,
        icon: "film-outline",
        blurb: "Photos and videos over 50 MB, grouped by size. Runs on your device and uses no credits.",
        empty: "Nothing on this device is over 50 MB.",
        noun: "file",
    },
    blurry: {
        title: "Blurry Photos",
        featureKey: "blurry_detector",
        creditKey: "blurry_photo_scan",
        icon: "eye-off-outline",
        blurb: "Checks your photos for blur and out-of-focus shots. The analysis happens on this device — no photo is uploaded.",
        empty: "No blurry photos found. Your library is in focus.",
        noun: "photo",
    },
    similar: {
        title: "Similar Photos",
        featureKey: "similar_photos",
        creditKey: "similar_photo_scan",
        icon: "copy-outline",
        blurb: "Groups near-identical shots so you can keep the best one. The analysis happens on this device — no photo is uploaded.",
        empty: "No near-identical shots found.",
        noun: "group",
    },
};

/** Photos only, capped, newest first — the input to both sampling modes. */
function sampleCandidates(assets) {
    return assets.filter((a) => !isVideoAsset(a) && a.localUri).slice(0, SAMPLE_LIMIT);
}

export default function StorageScanScreen({ route, navigation }) {
    const mode = MODES[route?.params?.mode] ?? MODES.screenshots;
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [phase, setPhase] = useState("idle"); // idle | scanning | done
    const [status, setStatus] = useState("");
    const [progress, setProgress] = useState(0);
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [partial, setPartial] = useState(false);
    const [scanned, setScanned] = useState(0);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [creditModal, setCreditModal] = useState({ visible: false, loading: false });
    const [featureCfg, setFeatureCfg] = useState(null);

    const cancelRef = useRef(false);
    const txnRef = useRef(null);
    const mounted = useRef(true);

    useEffect(() => {
        navigation.setOptions?.({ title: mode.title });
        return () => {
            mounted.current = false;
            cancelRef.current = true;
        };
    }, [navigation, mode.title]);

    // ── Permission ────────────────────────────────────────────────────────────
    // Asked at the point of use, which is what guideline 5.1.1 wants and what
    // the Permission Center (Module 2) deliberately does not do.
    const ensurePhotoAccess = useCallback(async () => {
        const perm = await MediaLibrary.requestPermissionsAsync(false);

        if (perm.status !== "granted") {
            Alert.alert(
                "Photo access needed",
                `${mode.title} reads your photo library on this device to find what to show you. Nothing is uploaded, and nothing is deleted without you confirming it.`,
                [
                    { text: "Not now", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]
            );
            return null;
        }

        const privileges = perm.accessPrivileges ?? "all";
        // Limited access is a supported outcome, not a failure: the scan covers
        // the chosen photos and the banner says the results are partial.
        setPartial(privileges === "limited");
        return privileges;
    }, [mode.title]);

    // ── Scanning ──────────────────────────────────────────────────────────────
    const runScan = useCallback(async () => {
        const shouldCancel = () => cancelRef.current;
        const step = (label, pct) => {
            if (!mounted.current) return;
            setStatus(label);
            setProgress(pct);
        };

        step("Reading your library…", 5);
        const assets = await enumerateAssets({
            shouldCancel,
            onCount: (n) => mounted.current && setScanned(n),
        });

        step("Reading file details…", 25);
        const enriched = await enrichAssets(assets, {
            shouldCancel,
            onProgress: (f) => mounted.current && setProgress(25 + Math.round(f * 35)),
        });

        const totalBytes = enriched.reduce((acc, a) => acc + (a.fileSize ?? 0), 0);

        let built = [];
        if (mode === MODES.screenshots) {
            step("Finding screenshots…", 80);
            built = findScreenshots(enriched).map((a) => ({
                id: a.id,
                label: a.filename || "Screenshot",
                subtitle: formatSize(a.fileSize),
                bytes: a.fileSize ?? 0,
                uri: a.localUri ?? a.uri,
                assetIds: [a.id],
            }));
        } else if (mode === MODES.large) {
            step("Measuring large files…", 80);
            built = bandLargeAssets(enriched).flatMap((band) =>
                band.items.map((a) => ({
                    id: a.id,
                    label: a.filename || "Large file",
                    subtitle: `${band.label} · ${formatSize(a.fileSize)}`,
                    bytes: a.fileSize ?? 0,
                    uri: a.localUri ?? a.uri,
                    assetIds: [a.id],
                }))
            );
        } else {
            // Both paid modes need the same per-image sample, so the expensive
            // pass runs once and each mode reads a different signal off it.
            const candidates = sampleCandidates(enriched);
            const sampled = [];
            for (let i = 0; i < candidates.length; i++) {
                if (shouldCancel()) throw new ScanCancelled();
                const a = candidates[i];
                const { hash, sharpness } = await sampleImage(a.localUri);
                sampled.push({ ...a, hash, sharpness });
                if (i % 25 === 0) {
                    step(
                        `Analysing photo ${i + 1} of ${candidates.length}…`,
                        60 + Math.round((i / Math.max(candidates.length, 1)) * 35)
                    );
                }
            }
            if (candidates.length === SAMPLE_LIMIT) setPartial(true);

            if (mode === MODES.blurry) {
                step("Scoring sharpness…", 96);
                built = sampled
                    // "unknown" is not "blurry". A photo we could not decode is
                    // left out rather than offered up for deletion.
                    .filter((a) => classifySharpness(a.sharpness) === "blurry")
                    .sort((a, b) => (a.sharpness ?? 0) - (b.sharpness ?? 0))
                    .map((a) => ({
                        id: a.id,
                        label: a.filename || "Photo",
                        subtitle: `Blurry · ${formatSize(a.fileSize)}`,
                        bytes: a.fileSize ?? 0,
                        uri: a.localUri ?? a.uri,
                        assetIds: [a.id],
                    }));
            } else {
                step("Grouping similar shots…", 96);
                built = groupSimilarByHash(sampled).map((g) => ({
                    id: g.id,
                    label: g.label,
                    subtitle: `${g.allCount} similar · keeps the newest · frees ${formatSize(g.totalBytes)}`,
                    bytes: g.totalBytes,
                    uri: sampled.find((a) => a.id === g.keepId)?.localUri,
                    assetIds: g.assetIds,
                }));
            }
        }

        step("Done", 100);

        // The only thing a scan persists: aggregates for the storage forecast.
        // No filename, path or asset id — see services/cleanerHistory.js.
        await recordScan({
            totalAssets: enriched.length,
            totalBytes,
            duplicateBytes: built.reduce((acc, r) => acc + r.bytes, 0),
            freeBytes: await freeDiskBytes(),
        });

        return built;
    }, [mode]);

    const start = useCallback(async () => {
        setPreparing(true);
        try {
            const access = await ensurePhotoAccess();
            if (!access) return;

            if (!mode.creditKey) {
                // Free layer: nothing to reserve, nothing to confirm.
                await beginScan(null);
                return;
            }

            // Cost comes from the backend, never from a constant in the app —
            // a hardcoded price here is wrong the moment it is changed server-side.
            const cfg = await getFeatureConfig(mode.creditKey).catch(() => null);
            setFeatureCfg(cfg);
            setCreditModal({ visible: true, loading: false });
        } finally {
            setPreparing(false);
        }
    }, [ensurePhotoAccess, mode]);

    async function beginScan(reservationNeeded) {
        cancelRef.current = false;
        setSelected(new Set());
        setRows([]);
        setScanned(0);
        setProgress(0);
        setPhase("scanning");

        if (reservationNeeded) {
            try {
                const reservation = await reserveCredits(mode.creditKey, null, 0);
                txnRef.current = reservation.transactionId;
            } catch (e) {
                setPhase("idle");
                if (showEntitlementDenial(e, navigation, mode.featureKey)) return;
                if (e?.response?.status === 402) {
                    const body = e.response?.data;
                    Alert.alert(
                        "Not enough credits",
                        `This scan needs ${body?.requiredCredits ?? featureCfg?.creditCost ?? 0} credits and you have ${body?.credits ?? 0}.`,
                        [
                            { text: "Not now", style: "cancel" },
                            { text: "View plans", onPress: () => navigation.navigate("Paywall", { featureKey: mode.featureKey }) },
                        ]
                    );
                } else {
                    Alert.alert("Could not start", "Please check your connection and try again.");
                }
                return;
            }
        }

        try {
            const built = await runScan();
            if (!mounted.current) return;
            setRows(built);
            setPhase("done");

            if (txnRef.current) {
                // A scan that ran to completion is the paid service, even when a
                // tidy library legitimately returns nothing — except that here it
                // is refunded, because charging for an empty report is what makes
                // a cleaner app feel like a scam.
                if (built.length === 0) {
                    await refundTransaction(txnRef.current, "Scan found nothing").catch(() => {});
                } else {
                    await completeTransaction(txnRef.current).catch(() => {});
                }
                txnRef.current = null;
            }
        } catch (err) {
            if (txnRef.current) {
                await refundTransaction(txnRef.current, err?.message ?? "Scan failed").catch(() => {});
                txnRef.current = null;
            }
            if (!mounted.current) return;
            setPhase("idle");
            if (!err?.cancelled) {
                Alert.alert(
                    "Scan failed",
                    mode.creditKey
                        ? "The scan could not finish and your credits have been returned."
                        : "The scan could not finish. Please try again."
                );
            }
        }
    }

    function cancel() {
        cancelRef.current = true;
        setStatus("Cancelling…");
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
    const selectedBytes = selectedRows.reduce((acc, r) => acc + r.bytes, 0);
    const selectedAssetIds = selectedRows.flatMap((r) => r.assetIds);

    const toggle = useCallback((id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    // ── Deletion ──────────────────────────────────────────────────────────────
    async function performDelete() {
        setDeleteConfirm(false);
        setDeleting(true);
        try {
            // MediaLibrary puts up the OS confirmation itself; this is the second
            // sheet, not the first.
            await MediaLibrary.deleteAssetsAsync(selectedAssetIds);

            // Rebuild from what is actually still there rather than assuming the
            // delete removed everything asked for — a partially confirmed OS
            // sheet is a normal outcome.
            const stillThere = new Set();
            await Promise.all(
                selectedAssetIds.map(async (id) => {
                    const asset = await MediaLibrary.getAssetInfoAsync(id).catch(() => null);
                    // A deleted asset throws on some platforms and resolves to a
                    // hollow object on others, so presence is judged on the id
                    // rather than on the call not having thrown.
                    if (asset?.id) stillThere.add(id);
                })
            );

            const remaining = rows.filter(
                (r) => !selected.has(r.id) || r.assetIds.some((id) => stillThere.has(id))
            );
            const removedCount = selectedAssetIds.length - stillThere.size;

            setRows(remaining);
            setSelected(new Set());

            if (removedCount === 0) {
                Alert.alert("Nothing was removed", "The items are still on your device.");
            } else if (stillThere.size > 0) {
                Alert.alert(
                    "Some items kept",
                    `${removedCount} removed. ${stillThere.size} could not be deleted and ${stillThere.size === 1 ? "is" : "are"} still listed.`
                );
            }
        } catch (err) {
            Alert.alert("Delete failed", err?.message || "Nothing was removed. Please try again.");
        } finally {
            setDeleting(false);
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    const renderRow = useCallback(
        ({ item }) => {
            const isSelected = selected.has(item.id);
            return (
                <Pressable
                    onPress={() => toggle(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${item.label}. ${item.subtitle}`}
                    style={({ pressed }) => [
                        styles.row,
                        isSelected && styles.rowSelected,
                        pressed && { opacity: 0.8 },
                    ]}
                >
                    {item.uri ? (
                        <Image source={{ uri: item.uri }} style={styles.thumb} />
                    ) : (
                        <View style={[styles.thumb, styles.thumbEmpty]}>
                            <Ionicons name={mode.icon} size={18} color={theme.colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                            {item.label}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                            {item.subtitle}
                        </Text>
                    </View>
                    <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                    />
                </Pressable>
            );
        },
        [selected, toggle, styles, theme, mode.icon]
    );

    const ROW_HEIGHT = 68;

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <View style={styles.header}>
                    <Text style={styles.blurb}>{mode.blurb}</Text>
                    {partial ? (
                        <Text style={styles.partial}>
                            Paper AI can only see some of your library, so these results are
                            partial.
                        </Text>
                    ) : null}
                </View>

                {phase === "idle" ? (
                    <View style={styles.centre}>
                        <Ionicons name={mode.icon} size={46} color={theme.colors.textMuted} />
                        <PrimaryButton
                            title={preparing ? "Checking…" : `Scan for ${mode.title.toLowerCase()}`}
                            onPress={start}
                            disabled={preparing}
                        />
                    </View>
                ) : null}

                {phase === "scanning" ? (
                    <View style={styles.centre}>
                        <ActivityIndicator color={theme.colors.primary} size="large" />
                        <Text style={styles.status}>{status}</Text>
                        <Text style={styles.statusSub}>
                            {scanned > 0 ? `${scanned} items read · ${progress}%` : `${progress}%`}
                        </Text>
                        <Pressable onPress={cancel} accessibilityRole="button" style={styles.cancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    </View>
                ) : null}

                {phase === "done" ? (
                    rows.length === 0 ? (
                        <View style={styles.centre}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={46}
                                color={theme.colors.success}
                            />
                            <Text style={styles.status}>{mode.empty}</Text>
                            {mode.creditKey ? (
                                <Text style={styles.statusSub}>
                                    Your credits have been returned.
                                </Text>
                            ) : null}
                        </View>
                    ) : (
                        <>
                            <View style={styles.toolbar}>
                                <Text style={styles.count}>
                                    {rows.length} {mode.noun}
                                    {rows.length === 1 ? "" : "s"} found
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() =>
                                        setSelected(
                                            selected.size === rows.length
                                                ? new Set()
                                                : new Set(rows.map((r) => r.id))
                                        )
                                    }
                                >
                                    <Text style={styles.selectAll}>
                                        {selected.size === rows.length ? "Clear" : "Select all"}
                                    </Text>
                                </Pressable>
                            </View>

                            <FlatList
                                data={rows}
                                renderItem={renderRow}
                                keyExtractor={(item) => item.id}
                                getItemLayout={(_, index) => ({
                                    length: ROW_HEIGHT,
                                    offset: ROW_HEIGHT * index,
                                    index,
                                })}
                                removeClippedSubviews
                                initialNumToRender={12}
                                windowSize={7}
                                contentContainerStyle={styles.list}
                            />

                            {selected.size > 0 ? (
                                <View style={styles.footer}>
                                    <Text style={styles.footerText}>
                                        {selectedAssetIds.length} selected ·{" "}
                                        {formatSize(selectedBytes)}
                                    </Text>
                                    <PrimaryButton
                                        title={deleting ? "Deleting…" : "Review and delete"}
                                        onPress={() => setDeleteConfirm(true)}
                                        disabled={deleting}
                                    />
                                </View>
                            ) : null}
                        </>
                    )
                ) : null}

                <CreditConfirmModal
                    visible={creditModal.visible}
                    title={featureCfg?.userNoticeTitle ?? `Start ${mode.title} scan`}
                    message={featureCfg?.userNoticeMessage ?? ""}
                    creditCost={featureCfg?.creditCost ?? 0}
                    loading={creditModal.loading}
                    onCancel={() => setCreditModal({ visible: false, loading: false })}
                    onConfirm={() => {
                        setCreditModal({ visible: false, loading: false });
                        beginScan(true);
                    }}
                />

                <ConfirmActionSheet
                    visible={deleteConfirm}
                    title={`Delete ${selectedAssetIds.length} item${selectedAssetIds.length === 1 ? "" : "s"}?`}
                    message={`This frees about ${formatSize(selectedBytes)}. Your device will ask you to confirm as well, and deleted photos go to Recently Deleted.`}
                    confirmText="Delete"
                    onCancel={() => setDeleteConfirm(false)}
                    onConfirm={performDelete}
                />
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1 },
        header: { paddingHorizontal: 18, paddingTop: 12, gap: 6 },
        blurb: { color: t.colors.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: "500" },
        partial: {
            color: t.colors.textMuted,
            fontSize: 12,
            fontWeight: "600",
            lineHeight: 17,
        },

        centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
        status: { color: t.colors.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" },
        statusSub: { color: t.colors.textMuted, fontSize: 12, fontWeight: "600" },
        cancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: 18 },
        cancelText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 14 },

        toolbar: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 18,
            paddingVertical: 12,
        },
        count: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },
        selectAll: { color: t.colors.accentText, fontWeight: "800", fontSize: 13, padding: 6 },

        list: { paddingHorizontal: 14, paddingBottom: 24 },
        row: {
            height: 68,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 10,
            borderRadius: 14,
        },
        rowSelected: { backgroundColor: t.colors.infoBg },
        thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: t.colors.glassSoft },
        thumbEmpty: { alignItems: "center", justifyContent: "center" },
        rowText: { flex: 1 },
        rowTitle: { color: t.colors.textPrimary, fontWeight: "700", fontSize: 14 },
        rowSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12, marginTop: 2 },

        footer: {
            padding: 16,
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.glass,
        },
        footerText: { color: t.colors.textSecondary, fontWeight: "700", fontSize: 13 },
    });
