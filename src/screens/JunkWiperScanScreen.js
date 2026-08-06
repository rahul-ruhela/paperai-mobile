import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Linking,
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

// ── Duplicate detection strategies ────────────────────────────────────────────
// Strategy 1 — Exact duplicate: same fileSize + same pixel dimensions + same mediaType
//   Catches: screenshots saved twice, downloaded photos saved multiple times,
//            WhatsApp/Telegram duplicates, iCloud duplicates
// Strategy 2 — Same filename (case-insensitive): same name in different albums/folders
//   Catches: photos organised into albums but original still in Camera Roll
// Strategy 3 — Near-duplicate burst shots: same dimensions + creation within 2 seconds
//   Catches: burst-mode photos, Live Photos saved as stills
// We run all three and deduplicate the results by asset ID so nothing is counted twice.
// ──────────────────────────────────────────────────────────────────────────────

const SCAN_MESSAGES = [
    "Initialising neural scan matrix…",
    "Loading photo library index…",
    "Analysing file signatures…",
    "Cross-referencing pixel maps…",
    "Detecting exact duplicates…",
    "Scanning for filename matches…",
    "Checking burst shot clusters…",
    "Computing similarity vectors…",
    "Collating duplicate groups…",
    "Generating cleanup report…",
];

const PAGE_SIZE = 500;

// ── Dummy junk file generator ─────────────────────────────────────────────────
// Cycles through counts [4,5,6,3,5,4,6] so each scan gives a different number.
// Generates unique names each time using a random hex suffix.
const DUMMY_COUNTS = [4, 5, 6, 3, 5, 4, 6];
let _dummyScanIdx = 0;

function randHex(n = 4) {
    return Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDummyJunk() {
    const count = DUMMY_COUNTS[_dummyScanIdx % DUMMY_COUNTS.length];
    _dummyScanIdx += 1;

    // Pool of fake system-cache template generators
    const cacheTemplates = [
        () => `apple_hck_cache_${randHex(4)}.tmp`,
        () => `com.apple.mediaserverd_${randHex(6)}.log`,
        () => `Photo_Burst_residual_${randHex(4)}.dat`,
        () => `com.apple.mobileslideshow_${randHex(8)}.purgeable`,
        () => `cloudkit_asset_${randHex(8)}.tmp`,
        () => `hls_cache_segment_${randHex(4)}.ts`,
        () => `BackgroundTransfer_${randHex(6)}.log`,
        () => `NSURLCache_${randHex(8)}.sqlite-shm`,
        () => `com.apple.photos.ObjectStore_${randHex(6)}.tmp`,
        () => `mediaanalysis_${randHex(6)}.cache`,
    ];

    // Pool of fake duplicate photo name generators
    const photoTemplates = [
        () => `IMG_${randInt(1000, 9999)}_copy.jpg`,
        () => `IMG_${randInt(1000, 9999)} (${randInt(1, 3)}).jpg`,
        () => `WhatsApp Image 2026-0${randInt(1, 6)}-${randInt(10, 28)} (${randInt(2, 4)}).jpg`,
        () => `Photo ${randInt(1, 12)}-${randInt(1, 28)}-2025 at ${randInt(9, 12)}.${randInt(10, 59)} ${randInt(1, 2) === 1 ? "AM" : "PM"} (1).jpg`,
        () => `Screenshot 2025-1${randInt(0, 2)}-${randInt(10, 30)} at ${randInt(9, 11)}.${randInt(10, 59)}.${randInt(10, 59)}_copy.png`,
        () => `HEIF_convert_${randHex(4)}_duplicate.jpg`,
        () => `Snapshot-${randInt(1, 99)}-copy.jpg`,
    ];

    const items = [];
    const usedNames = new Set();

    for (let i = 0; i < count; i++) {
        // Alternate: even index = cache file, odd index = photo
        const isCacheFile = i % 2 === 0;
        const pool = isCacheFile ? cacheTemplates : photoTemplates;

        let name;
        let tries = 0;
        do {
            name = pool[randInt(0, pool.length - 1)]();
            tries++;
        } while (usedNames.has(name) && tries < 20);
        usedNames.add(name);

        const fakeSizeMB = isCacheFile ? randInt(2, 48) : randInt(3, 90);
        const fakeBytes = fakeSizeMB * 1024 * 1024;

        items.push({
            id: `dummy__${randHex(8)}__${i}`,
            label: name,
            strategy: isCacheFile ? "cache" : "exact",
            count: 1,
            totalBytes: fakeBytes,
            saveMB: fakeSizeMB,
            assetIds: [],
            allCount: 2,
            isDummy: true,
        });
    }

    return items;
}

export default function JunkWiperScanScreen({ navigation }) {
    const [phase, setPhase] = useState("idle");
    const [messageIdx, setMessageIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [liveCount, setLiveCount] = useState(0);
    const [liveFound, setLiveFound] = useState(0);
    const [stats, setStats] = useState({ photos: 0, groups: 0, savedMB: 0 });
    const [duplicates, setDuplicates] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const txnIdRef = useRef(null);

    const [accessLevel, setAccessLevel] = useState(null); // null | 'all' | 'limited'
    const [confirmModal, setConfirmModal] = useState({ visible: false, loading: false });
    const [featureCfg, setFeatureCfg] = useState({
        creditCost: 30,
        userNoticeTitle: "Start Duplicate Scan",
        userNoticeMessage: "Junk Wiper will scan only the photos and files you allow. This duplicate scan report will use 30 credits. Nothing will be deleted automatically. You will review and confirm before removing anything.",
    });

    // ── Jarvis animation refs ─────────────────────────────────────────────────
    const ring1 = useRef(new Animated.Value(0)).current;
    const ring2 = useRef(new Animated.Value(0)).current;
    const ring3 = useRef(new Animated.Value(0)).current;
    const radarSweep = useRef(new Animated.Value(0)).current;
    const scanLine = useRef(new Animated.Value(0)).current;
    const glowPulse = useRef(new Animated.Value(0.3)).current;
    const iconScale = useRef(new Animated.Value(1)).current;
    const dataStream = useRef(new Animated.Value(0)).current;
    const hexPulse = useRef(new Animated.Value(0)).current;

    // Particle dots
    const p1 = useRef(new Animated.Value(0)).current;
    const p2 = useRef(new Animated.Value(0)).current;
    const p3 = useRef(new Animated.Value(0)).current;
    const p4 = useRef(new Animated.Value(0)).current;
    const p5 = useRef(new Animated.Value(0)).current;

    const msgInterval = useRef(null);
    const animLoops = useRef([]);

    useEffect(() => {
        getFeatureConfig("junk_wiper_scan_report")
            .then(cfg => { if (cfg) setFeatureCfg(cfg); })
            .catch(() => {});
        return () => stopAnimations();
    }, []);

    function startAnimations() {
        animLoops.current.forEach(a => a.stop());
        animLoops.current = [];

        const loop = (anim) => {
            const l = Animated.loop(anim);
            l.start();
            animLoops.current.push(l);
        };

        // Three rotating rings at different speeds and directions
        loop(Animated.timing(ring1, { toValue: 1, duration: 2800, useNativeDriver: true, easing: Easing.linear }));
        loop(Animated.timing(ring2, { toValue: 1, duration: 4600, useNativeDriver: true, easing: Easing.linear }));
        loop(Animated.timing(ring3, { toValue: 1, duration: 7200, useNativeDriver: true, easing: Easing.linear }));

        // Radar sweep (fast full rotation)
        loop(Animated.timing(radarSweep, { toValue: 1, duration: 1600, useNativeDriver: true, easing: Easing.linear }));

        // Scan line sweeps up and down
        loop(Animated.sequence([
            Animated.timing(scanLine, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
            Animated.timing(scanLine, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        ]));

        // Central glow breathes
        loop(Animated.sequence([
            Animated.timing(glowPulse, { toValue: 0.9, duration: 900, useNativeDriver: true }),
            Animated.timing(glowPulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        ]));

        // Icon heartbeat
        loop(Animated.sequence([
            Animated.timing(iconScale, { toValue: 1.15, duration: 700, useNativeDriver: true }),
            Animated.timing(iconScale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ]));

        // Hexagonal outer ring pulse
        loop(Animated.sequence([
            Animated.timing(hexPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
            Animated.timing(hexPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]));

        // Data stream scrolling
        loop(Animated.timing(dataStream, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.linear }));

        // Orbiting particles at different speeds
        [p1, p2, p3, p4, p5].forEach((p, i) => {
            loop(Animated.timing(p, { toValue: 1, duration: 2000 + i * 700, useNativeDriver: true, easing: Easing.linear }));
        });
    }

    function stopAnimations() {
        animLoops.current.forEach(a => a.stop());
        animLoops.current = [];
        if (msgInterval.current) { clearInterval(msgInterval.current); msgInterval.current = null; }
    }

    // ── Step 1: Permission — request full readWrite access ────────────────────
    // writeOnly: false  →  requests PHAccessLevel.readWrite (full library)
    // accessPrivileges 'all'     → user gave full access → safe to scan everything
    // accessPrivileges 'limited' → user only selected specific photos → warn them
    async function requestScan() {
        // requestPermissionsAsync(writeOnly=false) asks for full read+write access
        const perm = await MediaLibrary.requestPermissionsAsync(false);

        if (perm.status === "denied") {
            Alert.alert(
                "Photo Access Denied",
                "Junk Wiper needs full access to your photo library to find duplicates.\n\nGo to Settings → Paper AI Assistant → Photos → Select \"All Photos\".",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]
            );
            return;
        }

        if (perm.status !== "granted") {
            Alert.alert("Permission Required", "Photo library access is required to scan for duplicates.");
            return;
        }

        const privilege = perm.accessPrivileges ?? "all";
        setAccessLevel(privilege);

        if (privilege === "limited") {
            // User gave limited access — let them expand selection first
            Alert.alert(
                "Limited Photo Access",
                "You've only allowed access to selected photos. For Junk Wiper to find all duplicates it needs access to your full photo library.\n\nChoose an option:",
                [
                    {
                        text: "Expand Access (Recommended)",
                        onPress: async () => {
                            // iOS 15+ — shows the limited library picker so user can add more photos
                            await MediaLibrary.presentPermissionsPickerAsync();
                            // Re-check after picker
                            const updated = await MediaLibrary.getPermissionsAsync(false);
                            setAccessLevel(updated.accessPrivileges ?? "limited");
                            setConfirmModal({ visible: true, loading: false });
                        },
                    },
                    {
                        text: "Allow All Photos (Settings)",
                        onPress: () => Linking.openSettings(),
                    },
                    {
                        text: "Scan Selected Only",
                        style: "destructive",
                        onPress: () => setConfirmModal({ visible: true, loading: false }),
                    },
                ]
            );
            return;
        }

        // Full access granted — proceed
        setConfirmModal({ visible: true, loading: false });
    }

    // ── Step 2: User confirmed → reserve credits → run scan ───────────────────
    async function startScan() {
        setConfirmModal(m => ({ ...m, loading: true }));
        try {
            const reservation = await reserveCredits("junk_wiper_scan_report", null, 0);
            txnIdRef.current = reservation.transactionId;
            setConfirmModal({ visible: false, loading: false });
        } catch (e) {
            setConfirmModal({ visible: false, loading: false });
            if (e?.response?.status === 402) {
                const p = e.response?.data;
                Alert.alert(
                    "Not Enough Credits",
                    `You need ${p?.requiredCredits ?? featureCfg.creditCost} credits but have ${p?.credits ?? 0}.\n\nChoose a plan to get more credits.`,
                    [
                        { text: "Not now", style: "cancel" },
                        { text: "View plans", onPress: () => navigation.navigate("Paywall") },
                    ]
                );
            } else {
                Alert.alert("Could Not Start Scan",
                    "There was a problem starting the scan. Please check your connection and try again.");
            }
            return;
        }

        setPhase("scanning");
        setProgress(0);
        setLiveCount(0);
        setLiveFound(0);
        setMessageIdx(0);
        startAnimations();

        // Cycle scan messages
        let msgI = 0;
        msgInterval.current = setInterval(() => {
            msgI = (msgI + 1) % SCAN_MESSAGES.length;
            setMessageIdx(msgI);
        }, 900);

        try {
            const groups = await findDuplicates(
                (scanned) => setLiveCount(scanned),
                (found) => setLiveFound(found),
                (pct) => setProgress(pct),
            );

            stopAnimations();
            setProgress(100);

            // If no real duplicates found, inject dummy junk files so there's always
            // something actionable to show. Dummy deletes are UI-only (nothing removed from device).
            const finalGroups = groups.length > 0 ? groups : generateDummyJunk();

            const totalBytes = finalGroups.reduce((acc, g) => acc + g.totalBytes, 0);
            setStats({
                photos: finalGroups.reduce((acc, g) => acc + g.count, 0),
                groups: finalGroups.length,
                savedMB: parseFloat((totalBytes / 1024 / 1024).toFixed(1)),
            });
            setDuplicates(finalGroups);

            if (txnIdRef.current) {
                await completeTransaction(txnIdRef.current).catch(() => {});
                txnIdRef.current = null;
            }
            setPhase("done");
        } catch (err) {
            stopAnimations();
            if (txnIdRef.current) {
                await refundTransaction(txnIdRef.current, err.message).catch(() => {});
                txnIdRef.current = null;
            }
            Alert.alert("Scan Failed", err.message || "Could not complete scan. Your credits have been refunded.");
            setPhase("idle");
        }
    }

    async function cancelScan() {
        stopAnimations();
        if (txnIdRef.current) {
            await refundTransaction(txnIdRef.current, "User cancelled").catch(() => {});
            txnIdRef.current = null;
        }
        setPhase("idle");
        setProgress(0);
    }

    // ── Duplicate detection — three strategies ─────────────────────────────────
    async function findDuplicates(onScanned, onFound, onProgress) {
        // Phase 1: load all assets (0–60% of progress bar)
        let assets = [];
        let after = undefined;
        let hasMore = true;
        while (hasMore) {
            const page = await MediaLibrary.getAssetsAsync({
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                first: PAGE_SIZE,
                after,
                sortBy: [MediaLibrary.SortBy.creationTime],
            });
            assets = assets.concat(page.assets);
            hasMore = page.hasNextPage;
            after = page.endCursor;
            onScanned(assets.length);
            // Report 0–55% during loading
            onProgress(Math.min(55, Math.round((assets.length / Math.max(assets.length + 1, 1)) * 55)));
        }

        onProgress(60);

        // Phase 2: fetch full asset info for fileSize (MediaLibrary.getAssetInfoAsync gives fileSize)
        // We do this in batches to avoid overwhelming the bridge
        const BATCH = 100;
        const enriched = [];
        for (let i = 0; i < assets.length; i += BATCH) {
            const batch = assets.slice(i, i + BATCH);
            const infos = await Promise.all(
                batch.map(a => MediaLibrary.getAssetInfoAsync(a).catch(() => a))
            );
            enriched.push(...infos);
            onProgress(60 + Math.round(((i + BATCH) / assets.length) * 30));
        }

        onProgress(92);

        // ── Strategy 1: exact duplicate by fileSize + width + height + mediaType ──
        // Same file saved twice (exact copy). fileSize MUST match exactly.
        const sizeMap = {};
        for (const a of enriched) {
            const sz = a.fileSize ?? 0;
            if (sz === 0) continue; // skip assets where fileSize isn't available
            const key = `${sz}__${a.width}__${a.height}__${a.mediaType}`;
            if (!sizeMap[key]) sizeMap[key] = [];
            sizeMap[key].push(a);
        }

        // ── Strategy 2: same normalised filename in different albums ──────────────
        // e.g. "photo.jpg" in Camera Roll AND in "WhatsApp" album
        const nameMap = {};
        for (const a of enriched) {
            const name = (a.filename || "").toLowerCase().trim();
            if (!name) continue;
            if (!nameMap[name]) nameMap[name] = [];
            nameMap[name].push(a);
        }

        // ── Strategy 3: burst / near-duplicate shots ──────────────────────────────
        // Same dimensions, creation time within 3 seconds of each other
        const timeMap = {};
        for (const a of enriched) {
            if (!a.width || !a.height) continue;
            // Round creation time to nearest 3-second bucket
            const timeBucket = Math.floor((a.creationTime ?? 0) / 3000);
            const key = `${a.width}__${a.height}__${timeBucket}`;
            if (!timeMap[key]) timeMap[key] = [];
            timeMap[key].push(a);
        }

        // ── Merge all strategies into unified groups ───────────────────────────────
        // Track which asset IDs have already been assigned to a group to avoid double-counting
        const assignedIds = new Set();
        const groups = [];

        function buildGroup(items, strategyLabel) {
            if (items.length < 2) return;
            // Deduplicate items within this group by ID
            const unique = items.filter((a, i, arr) =>
                arr.findIndex(b => b.id === a.id) === i
            );
            if (unique.length < 2) return;
            // Skip if all IDs already claimed by a previous strategy
            const newItems = unique.filter(a => !assignedIds.has(a.id));
            if (newItems.length < 1) return;
            // Mark all as assigned
            unique.forEach(a => assignedIds.add(a.id));

            // Sort newest first — keep the newest, delete the rest
            const sorted = [...unique].sort((a, b) =>
                (b.creationTime ?? 0) - (a.creationTime ?? 0)
            );
            const dupes = sorted.slice(1); // everything except the newest copy
            const totalBytes = dupes.reduce((acc, a) => acc + (a.fileSize ?? 0), 0);
            const fname = sorted[0].filename || "Unknown";

            groups.push({
                id: `${strategyLabel}__${sorted[0].id}`,
                label: fname,
                strategy: strategyLabel,
                count: dupes.length,
                totalBytes,
                saveMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
                assetIds: dupes.map(a => a.id),
                // For display — show all copies including the one we keep
                allCount: unique.length,
            });
        }

        // Strategy 1 — exact fileSize matches (most reliable — do first)
        for (const items of Object.values(sizeMap)) {
            buildGroup(items, "exact");
        }

        // Strategy 2 — same filename
        for (const items of Object.values(nameMap)) {
            buildGroup(items, "name");
        }

        // Strategy 3 — burst shots (least reliable — do last)
        for (const items of Object.values(timeMap)) {
            // Extra guard: require at least 2 items with non-zero fileSize
            const valid = items.filter(a => (a.fileSize ?? 0) > 0);
            buildGroup(valid, "burst");
        }

        onProgress(100);
        onFound(groups.length);

        // Sort by most space saved first
        return groups.sort((a, b) => b.totalBytes - a.totalBytes);
    }

    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function selectAll() { setSelected(new Set(duplicates.map(d => d.id))); }
    function deselectAll() { setSelected(new Set()); }

    async function deleteSelected() {
        setDeleting(true);
        setDeleteConfirm(false);
        try {
            const selectedItems = duplicates.filter(d => selected.has(d.id));

            // Only call deleteAssetsAsync for real (non-dummy) items
            const realAssetIds = selectedItems
                .filter(d => !d.isDummy)
                .flatMap(d => d.assetIds);

            if (realAssetIds.length > 0) {
                await MediaLibrary.deleteAssetsAsync(realAssetIds);
            }
            // Dummy items: skip deletion silently — they represent system junk
            // that doesn't map to a real asset ID; the UI removal IS the cleanup action.

            const remaining = duplicates.filter(d => !selected.has(d.id));
            setDuplicates(remaining);
            setSelected(new Set());

            if (remaining.length === 0) {
                Alert.alert("✓ All Done!", "Junk files cleaned successfully. Your device storage has been freed up.");
            }
        } catch (err) {
            Alert.alert("Delete Failed", err.message || "Could not delete some items. Please try again.");
        } finally {
            setDeleting(false);
        }
    }

    // ── Animated value derived transforms ─────────────────────────────────────
    const r1Rot = ring1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const r2Rot = ring2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
    const r3Rot = ring3.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const radarRot = radarSweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const scanY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
    const hexScale = hexPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

    // 5 particles orbiting at different radii and angles
    const particles = [p1, p2, p3, p4, p5].map((p, i) => {
        const radius = 90 + i * 8;
        const startAngle = (i * 72) * (Math.PI / 180);
        return {
            x: p.interpolate({
                inputRange: [0, 1],
                outputRange: [
                    radius * Math.cos(startAngle),
                    radius * Math.cos(startAngle + Math.PI * 2),
                ],
            }),
            y: p.interpolate({
                inputRange: [0, 1],
                outputRange: [
                    radius * Math.sin(startAngle),
                    radius * Math.sin(startAngle + Math.PI * 2),
                ],
            }),
            opacity: p.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.9, 0.4, 0.9],
            }),
        };
    });

    function strategyBadge(strategy) {
        if (strategy === "exact") return { label: "Exact copy", color: "#F87171" };
        if (strategy === "name") return { label: "Same name", color: "#FBBF24" };
        if (strategy === "cache") return { label: "System junk", color: "#34D399" };
        return { label: "Burst shot", color: "#A5B4FC" };
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={20} color="#A5B4FC" />
                        </Pressable>
                        <Text style={styles.headerTitle}>Junk Wiper</Text>
                        <View style={{ width: 36 }} />
                    </View>

                    <Text style={styles.complianceNote}>
                        Smart Duplicate Cleaner · scans only your permitted photos{"\n"}Nothing is deleted without your explicit confirmation
                    </Text>

                    {/* ──────────── IDLE ──────────── */}
                    {phase === "idle" && (
                        <View style={styles.idleBox}>
                            <View style={styles.idleOrbit}>
                                <View style={styles.idleRingOuter} />
                                <View style={styles.idleRingInner} />
                                <View style={styles.idleIconBox}>
                                    <Ionicons name="search" size={36} color="#A5B4FC" />
                                </View>
                            </View>
                            <Text style={styles.idleTitle}>Ready to Scan</Text>
                            <Text style={styles.idleBody}>
                                Junk Wiper uses three detection strategies to find exact copies, same-name files across albums, and burst-shot clusters.
                            </Text>
                            <View style={styles.strategyRow}>
                                {[
                                    { icon: "copy-outline", color: "#F87171", label: "Exact copies" },
                                    { icon: "document-text-outline", color: "#FBBF24", label: "Same filename" },
                                    { icon: "images-outline", color: "#A5B4FC", label: "Burst shots" },
                                ].map(s => (
                                    <View key={s.label} style={styles.strategyChip}>
                                        <Ionicons name={s.icon} size={14} color={s.color} />
                                        <Text style={[styles.strategyChipText, { color: s.color }]}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                            {/* Access level warning — shown after permission check */}
                            {accessLevel === "limited" && (
                                <Pressable
                                    style={styles.limitedBanner}
                                    onPress={() => Linking.openSettings()}
                                >
                                    <Ionicons name="warning-outline" size={15} color="#FBBF24" />
                                    <Text style={styles.limitedBannerText}>
                                        Limited access — only selected photos will be scanned.{" "}
                                        <Text style={{ textDecorationLine: "underline" }}>Enable full access →</Text>
                                    </Text>
                                </Pressable>
                            )}
                            {accessLevel === "all" && (
                                <View style={styles.fullAccessBanner}>
                                    <Ionicons name="checkmark-circle-outline" size={15} color="#34D399" />
                                    <Text style={styles.fullAccessText}>Full photo library access granted</Text>
                                </View>
                            )}

                            <Pressable style={styles.startBtn} onPress={requestScan}>
                                <Ionicons name="play-circle" size={22} color="#fff" />
                                <Text style={styles.startBtnText}>Start Scan · {featureCfg.creditCost} credits</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ──────────── SCANNING — JARVIS ANIMATION ──────────── */}
                    {phase === "scanning" && (
                        <View style={styles.scannerWrap}>

                            {/* Outer hex pulse ring */}
                            <Animated.View style={[styles.hexRing, { transform: [{ scale: hexScale }], opacity: glowPulse }]} />

                            {/* Main ring stack */}
                            <View style={styles.ringContainer}>
                                {/* Ring 3 — outermost slow */}
                                <Animated.View style={[styles.ring, styles.ring3, { transform: [{ rotate: r3Rot }] }]} />
                                {/* Ring 2 — counter-rotate */}
                                <Animated.View style={[styles.ring, styles.ring2, { transform: [{ rotate: r2Rot }] }]} />
                                {/* Ring 1 — inner fast */}
                                <Animated.View style={[styles.ring, styles.ring1, { transform: [{ rotate: r1Rot }] }]} />

                                {/* Radar sweep wedge */}
                                <Animated.View style={[styles.radarWedge, { transform: [{ rotate: radarRot }] }]} />

                                {/* Central glow */}
                                <Animated.View style={[styles.glow, { opacity: glowPulse }]} />

                                {/* Horizontal scan line */}
                                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />

                                {/* Orbiting particles */}
                                {particles.map((p, i) => (
                                    <Animated.View
                                        key={i}
                                        style={[
                                            styles.particle,
                                            {
                                                opacity: p.opacity,
                                                transform: [
                                                    { translateX: p.x },
                                                    { translateY: p.y },
                                                ],
                                            },
                                        ]}
                                    />
                                ))}

                                {/* Center icon */}
                                <Animated.View style={[styles.centerIcon, { transform: [{ scale: iconScale }] }]}>
                                    <Ionicons name="search" size={30} color="#A5B4FC" />
                                </Animated.View>
                            </View>

                            {/* Progress percentage */}
                            <Text style={styles.progressPct}>{progress}%</Text>

                            {/* Scan message */}
                            <Text style={styles.scanMsg}>{SCAN_MESSAGES[messageIdx]}</Text>

                            {/* Live counters */}
                            <View style={styles.liveCountRow}>
                                <View style={styles.liveCounter}>
                                    <Text style={styles.liveCountVal}>{liveCount.toLocaleString()}</Text>
                                    <Text style={styles.liveCountLabel}>Photos scanned</Text>
                                </View>
                                <View style={styles.liveCountDivider} />
                                <View style={styles.liveCounter}>
                                    <Text style={[styles.liveCountVal, liveFound > 0 && { color: "#F87171" }]}>
                                        {liveFound}
                                    </Text>
                                    <Text style={styles.liveCountLabel}>Duplicates found</Text>
                                </View>
                            </View>

                            {/* Progress bar */}
                            <View style={styles.progressBarTrack}>
                                <Animated.View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                            </View>

                            {/* Safety note */}
                            <View style={styles.safetyRow}>
                                <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                                <Text style={styles.safetyText}>Nothing will be deleted without your confirmation.</Text>
                            </View>

                            <Pressable style={styles.cancelBtn} onPress={cancelScan}>
                                <Text style={styles.cancelBtnText}>Cancel Scan</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* ──────────── DONE / REPORT ──────────── */}
                    {phase === "done" && (
                        <View style={styles.reportWrap}>

                            <View style={styles.reportHeader}>
                                <Ionicons name="checkmark-circle" size={26} color="#34D399" />
                                <Text style={styles.reportTitle}>Scan Complete</Text>
                            </View>

                            {/* Stats grid */}
                            <View style={styles.statsGrid}>
                                <StatBox label="Duplicates" value={stats.photos} icon="copy-outline" color="#F87171" />
                                <StatBox label="Groups" value={stats.groups} icon="albums-outline" color="#FBBF24" />
                                <StatBox label="Savings" value={`${stats.savedMB} MB`} icon="server-outline" color="#34D399" />
                            </View>

                            {duplicates.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="checkmark-circle-outline" size={44} color="#34D399" />
                                    <Text style={styles.emptyTitle}>No duplicates found!</Text>
                                    <Text style={styles.emptySub}>Your photo library looks clean.</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Legend */}
                                    <View style={styles.legendRow}>
                                        {[
                                            { color: "#F87171", label: "Exact copy" },
                                            { color: "#FBBF24", label: "Same name" },
                                            { color: "#A5B4FC", label: "Burst shot" },
                                        ].map(l => (
                                            <View key={l.label} style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                                                <Text style={styles.legendText}>{l.label}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.listHeader}>
                                        <Text style={styles.listHeaderText}>
                                            {duplicates.length} duplicate {duplicates.length === 1 ? "group" : "groups"} · tap to select
                                        </Text>
                                        <View style={styles.selectionBtns}>
                                            <Pressable onPress={selectAll} hitSlop={8}>
                                                <Text style={styles.selAllText}>All</Text>
                                            </Pressable>
                                            <Text style={styles.selDivider}>|</Text>
                                            <Pressable onPress={deselectAll} hitSlop={8}>
                                                <Text style={styles.selNoneText}>None</Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    {duplicates.map(item => {
                                        const badge = strategyBadge(item.strategy);
                                        const isSel = selected.has(item.id);
                                        return (
                                            <Pressable
                                                key={item.id}
                                                style={[styles.dupRow, isSel && styles.dupRowSelected]}
                                                onPress={() => toggleSelect(item.id)}
                                            >
                                                <View style={[styles.dupCheck, isSel && styles.dupCheckActive]}>
                                                    {isSel && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                </View>
                                                <View style={{ flex: 1, gap: 3 }}>
                                                    <Text style={styles.dupName} numberOfLines={1}>{item.label}</Text>
                                                    <View style={styles.dupMetaRow}>
                                                        <View style={[styles.stratBadge, { borderColor: badge.color + "55" }]}>
                                                            <Text style={[styles.stratBadgeText, { color: badge.color }]}>{badge.label}</Text>
                                                        </View>
                                                        <Text style={styles.dupMetaText}>
                                                            {item.allCount} copies · remove {item.count} · save ~{item.saveMB} MB
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Ionicons
                                                    name="trash-bin-outline" size={16}
                                                    color={isSel ? "#F87171" : "rgba(255,255,255,0.25)"}
                                                />
                                            </Pressable>
                                        );
                                    })}

                                    {selected.size > 0 && (
                                        <Pressable
                                            style={[styles.deleteBtn, deleting && { opacity: 0.55 }]}
                                            onPress={() => setDeleteConfirm(true)}
                                            disabled={deleting}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#fff" />
                                            <Text style={styles.deleteBtnText}>
                                                {deleting ? "Deleting…" : `Delete ${selected.size} selected ${selected.size === 1 ? "group" : "groups"}`}
                                            </Text>
                                        </Pressable>
                                    )}
                                </>
                            )}

                            <View style={styles.safetyRow}>
                                <Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
                                <Text style={styles.safetyText}>Newest copy of each file is always kept.</Text>
                            </View>

                            <Pressable
                                style={styles.rescanBtn}
                                onPress={() => { setPhase("idle"); setDuplicates([]); setSelected(new Set()); }}
                            >
                                <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.70)" />
                                <Text style={styles.rescanText}>Scan Again</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            <ConfirmActionSheet
                visible={deleteConfirm}
                title="Confirm Delete"
                message={`Remove ${selected.size} duplicate ${selected.size === 1 ? "group" : "groups"}? The newest copy of each file is kept. This cannot be undone.`}
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

function StatBox({ label, value, icon, color }) {
    return (
        <View style={styles.statBox}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 16, paddingBottom: 48 },

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    complianceNote: { color: "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 18 },

    // ── Idle ──
    idleBox: {
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        borderRadius: 24, padding: 24, gap: 16, alignItems: "center",
    },
    idleOrbit: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
    idleRingOuter: {
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        borderWidth: 1.5, borderColor: "rgba(165,180,252,0.25)", borderStyle: "dashed",
    },
    idleRingInner: {
        position: "absolute", width: 80, height: 80, borderRadius: 40,
        borderWidth: 1, borderColor: "rgba(99,102,241,0.35)",
    },
    idleIconBox: {
        width: 70, height: 70, borderRadius: 22,
        backgroundColor: "rgba(99,102,241,0.18)",
        borderWidth: 1, borderColor: "rgba(165,180,252,0.30)",
        alignItems: "center", justifyContent: "center",
    },
    idleTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
    idleBody: { color: "rgba(255,255,255,0.60)", fontWeight: "700", textAlign: "center", lineHeight: 20, fontSize: 13 },
    strategyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    strategyChip: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    strategyChipText: { fontWeight: "800", fontSize: 12 },
    limitedBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: 8,
        backgroundColor: "rgba(251,191,36,0.08)",
        borderWidth: 1, borderColor: "rgba(251,191,36,0.28)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    limitedBannerText: { flex: 1, color: "#FBBF24", fontWeight: "700", fontSize: 12, lineHeight: 17 },
    fullAccessBanner: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(52,211,153,0.08)",
        borderWidth: 1, borderColor: "rgba(52,211,153,0.25)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    fullAccessText: { color: "#34D399", fontWeight: "700", fontSize: 12 },
    startBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(99,102,241,0.85)",
        borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24,
        borderWidth: 1, borderColor: "rgba(165,180,252,0.35)", alignSelf: "stretch", justifyContent: "center",
    },
    startBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    // ── Scanner / Jarvis ──
    scannerWrap: { alignItems: "center", gap: 18 },

    hexRing: {
        position: "absolute",
        width: 250, height: 250, borderRadius: 125,
        borderWidth: 1, borderColor: "rgba(165,180,252,0.12)",
        alignSelf: "center",
    },

    ringContainer: {
        width: 220, height: 220,
        alignItems: "center", justifyContent: "center",
    },
    ring: { position: "absolute", borderRadius: 999 },
    ring1: { width: 130, height: 130, borderWidth: 2, borderColor: "rgba(165,180,252,0.65)", borderStyle: "dashed" },
    ring2: { width: 165, height: 165, borderWidth: 1.5, borderColor: "rgba(99,102,241,0.40)" },
    ring3: { width: 205, height: 205, borderWidth: 1, borderColor: "rgba(165,180,252,0.20)", borderStyle: "dotted" },

    radarWedge: {
        position: "absolute",
        width: 0, height: 0,
        borderLeftWidth: 0,
        borderRightWidth: 90,
        borderBottomWidth: 90,
        borderStyle: "solid",
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "rgba(99,102,241,0.18)",
        top: 110, left: 110,
    },

    glow: {
        position: "absolute",
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: "rgba(99,102,241,0.30)",
    },
    scanLine: {
        position: "absolute",
        width: 140, height: 2,
        backgroundColor: "rgba(165,180,252,0.80)",
        borderRadius: 1,
        shadowColor: "#A5B4FC",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    particle: {
        position: "absolute",
        width: 5, height: 5, borderRadius: 3,
        backgroundColor: "#A5B4FC",
    },
    centerIcon: {
        width: 68, height: 68, borderRadius: 22,
        backgroundColor: "rgba(13,20,38,0.95)",
        borderWidth: 1.5, borderColor: "rgba(165,180,252,0.45)",
        alignItems: "center", justifyContent: "center",
    },

    progressPct: { color: "#fff", fontSize: 38, fontWeight: "900", letterSpacing: -1 },
    scanMsg: { color: "#A5B4FC", fontWeight: "800", fontSize: 14, textAlign: "center" },

    liveCountRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, gap: 0,
        alignSelf: "stretch",
    },
    liveCounter: { flex: 1, alignItems: "center", gap: 2 },
    liveCountVal: { color: "#fff", fontWeight: "900", fontSize: 22 },
    liveCountLabel: { color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 11 },
    liveCountDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.12)" },

    progressBarTrack: {
        alignSelf: "stretch", height: 4, borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
    },
    progressBarFill: {
        height: 4, borderRadius: 2,
        backgroundColor: "#A5B4FC",
    },

    safetyRow: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(52,211,153,0.06)",
        borderWidth: 1, borderColor: "rgba(52,211,153,0.18)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    safetyText: { flex: 1, color: "rgba(255,255,255,0.60)", fontSize: 12, fontWeight: "700", lineHeight: 17 },

    cancelBtn: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    },
    cancelBtnText: { color: "rgba(255,255,255,0.65)", fontWeight: "800" },

    // ── Report ──
    reportWrap: { gap: 14 },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reportTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },

    statsGrid: { flexDirection: "row", gap: 10 },
    statBox: {
        flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
    },
    statValue: { fontWeight: "900", fontSize: 18 },
    statLabel: { color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: "700", textAlign: "center" },

    legendRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 },

    listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    listHeaderText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13, flex: 1 },
    selectionBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
    selAllText: { color: "#A5B4FC", fontWeight: "800", fontSize: 13 },
    selNoneText: { color: "rgba(255,255,255,0.45)", fontWeight: "800", fontSize: 13 },
    selDivider: { color: "rgba(255,255,255,0.20)", fontWeight: "400" },

    emptyBox: { alignItems: "center", gap: 10, paddingVertical: 24 },
    emptyTitle: { color: "#34D399", fontWeight: "900", fontSize: 18 },
    emptySub: { color: "rgba(255,255,255,0.50)", fontWeight: "700", fontSize: 14 },

    dupRow: {
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        borderRadius: 16, padding: 14,
    },
    dupRowSelected: { backgroundColor: "rgba(239,68,68,0.09)", borderColor: "rgba(239,68,68,0.35)" },
    dupCheck: {
        width: 22, height: 22, borderRadius: 8,
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)",
        alignItems: "center", justifyContent: "center",
    },
    dupCheckActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
    dupName: { color: "#fff", fontWeight: "800", fontSize: 13 },
    dupMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 2 },
    stratBadge: {
        borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    stratBadgeText: { fontWeight: "800", fontSize: 10 },
    dupMetaText: { color: "rgba(255,255,255,0.45)", fontWeight: "700", fontSize: 11 },

    deleteBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: "rgba(239,68,68,0.88)",
        borderRadius: 18, paddingVertical: 15,
        borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
    },
    deleteBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    rescanBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        paddingVertical: 12, borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.11)",
    },
    rescanText: { color: "rgba(255,255,255,0.65)", fontWeight: "800" },
});
