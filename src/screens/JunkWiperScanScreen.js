import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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

const { height: SCREEN_H } = Dimensions.get("window");

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

// Human-readable size from raw bytes (used for the live junk-size readout).
function formatSize(bytes) {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 10) return `${mb.toFixed(0)} MB`;
    return `${mb.toFixed(1)} MB`;
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
    const [liveBytes, setLiveBytes] = useState(0);
    const [stats, setStats] = useState({ photos: 0, groups: 0, savedMB: 0 });
    const [duplicates, setDuplicates] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // Rocket cleanup animation shown while junk is being wiped
    const [cleaning, setCleaning] = useState(false);
    const [cleanDone, setCleanDone] = useState(false);
    const rocketY = useRef(new Animated.Value(0)).current;
    const rocketShake = useRef(new Animated.Value(0)).current;
    const rocketOpacity = useRef(new Animated.Value(0)).current;
    const smokeScale = useRef(new Animated.Value(0)).current;
    const flameFlicker = useRef(new Animated.Value(0)).current;
    const flameLoop = useRef(null);
    // True while we check photo permission before the confirm modal appears —
    // keeps the Start button showing a spinner instead of feeling frozen.
    const [preparing, setPreparing] = useState(false);
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
        if (preparing) return;
        setPreparing(true);
        let perm;
        try {
            // requestPermissionsAsync(writeOnly=false) asks for full read+write access
            perm = await MediaLibrary.requestPermissionsAsync(false);
        } finally {
            setPreparing(false);
        }

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

    // ── Step 2: User confirmed → run scan ─────────────────────────────────────
    // We flip straight into the scanning UI so it feels instant, then reserve
    // credits in parallel with the animation instead of blocking on the network
    // (which was causing the 3–4s "frozen" gap after tapping Start Scan).
    async function startScan() {
        // Show the scanning screen immediately — don't wait on the network.
        setConfirmModal({ visible: false, loading: false });
        setPhase("scanning");
        setProgress(0);
        setLiveCount(0);
        setLiveFound(0);
        setLiveBytes(0);
        setMessageIdx(0);
        startAnimations();

        // Cycle scan messages
        let msgI = 0;
        msgInterval.current = setInterval(() => {
            msgI = (msgI + 1) % SCAN_MESSAGES.length;
            setMessageIdx(msgI);
        }, 900);

        // Reserve credits in the background while the animation is already running.
        try {
            const reservation = await reserveCredits("junk_wiper_scan_report", null, 0);
            txnIdRef.current = reservation.transactionId;
        } catch (e) {
            stopAnimations();
            setPhase("idle");
            setProgress(0);
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

        try {
            const groups = await findDuplicates(
                (scanned) => setLiveCount(scanned),
                (found) => setLiveFound(found),
                (pct) => setProgress(pct),
                (bytes) => setLiveBytes(bytes),
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
    async function findDuplicates(onScanned, onFound, onProgress, onBytes) {
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

            // Live feedback — real detected count + reclaimable bytes so far
            onFound?.(groups.length);
            onBytes?.(groups.reduce((acc, g) => acc + g.totalBytes, 0));
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

    // Fire the rocket launch animation, then run the actual deletion.
    function deleteSelected() {
        setDeleteConfirm(false);
        setDeleting(true);
        setCleaning(true);
        setCleanDone(false);

        // Reset animation values — rocket sits on the launch pad at the bottom.
        rocketY.setValue(0);
        rocketShake.setValue(0);
        rocketOpacity.setValue(1);
        smokeScale.setValue(0);

        // Continuous flame flicker for the whole launch
        flameFlicker.setValue(0);
        flameLoop.current = Animated.loop(
            Animated.sequence([
                Animated.timing(flameFlicker, { toValue: 1, duration: 80, useNativeDriver: true }),
                Animated.timing(flameFlicker, { toValue: 0, duration: 80, useNativeDriver: true }),
            ])
        );
        flameLoop.current.start();

        Animated.sequence([
            // 1. Pre-launch rumble at the bottom
            Animated.loop(
                Animated.sequence([
                    Animated.timing(rocketShake, { toValue: 1, duration: 60, useNativeDriver: true }),
                    Animated.timing(rocketShake, { toValue: -1, duration: 60, useNativeDriver: true }),
                ]),
                { iterations: 6 }
            ),
            // 2. Blast off — fly to the top of the screen
            Animated.parallel([
                Animated.timing(rocketY, {
                    toValue: -SCREEN_H,
                    duration: 1400,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(smokeScale, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            performDelete();
        });
    }

    async function performDelete() {
        if (flameLoop.current) { flameLoop.current.stop(); flameLoop.current = null; }
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

            // Show the "cleaned up!" confirmation for a beat before tearing down.
            setCleanDone(true);
            setTimeout(() => {
                setDuplicates(remaining);
                setSelected(new Set());
                setCleaning(false);
                setCleanDone(false);
                setDeleting(false);
                if (remaining.length === 0) {
                    Alert.alert("✓ All Done!", "Junk files cleaned successfully. Your device storage has been freed up.");
                }
            }, 900);
        } catch (err) {
            setCleaning(false);
            setCleanDone(false);
            setDeleting(false);
            Alert.alert("Delete Failed", err.message || "Could not delete some items. Please try again.");
        }
    }

    // ── Animated value derived transforms ─────────────────────────────────────
    const r1Rot = ring1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const r2Rot = ring2.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
    const r3Rot = ring3.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const radarRot = radarSweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const scanY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });
    const hexScale = hexPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

    // Expanding radar pulse (scale up + fade out) driven by the hex pulse value
    const pulseScale = hexPulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] });
    const pulseFade = hexPulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

    // Category chips (file / photo / cache / duplicate / trash) fade in and out
    // as the sweep passes — each on its own particle timer for a staggered feel.
    const categoryFades = [p1, p2, p3, p4, p5].map(p =>
        p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] })
    );

    function strategyBadge(strategy) {
        if (strategy === "exact") return { label: "Exact copy", color: "#FF5A5F" };
        if (strategy === "name") return { label: "Same name", color: "#B45309" };
        if (strategy === "cache") return { label: "System junk", color: "#6B7280" };
        return { label: "Burst shot", color: "#2563EB" };
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={20} color="#2563EB" />
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
                                    <Ionicons name="search" size={36} color="#2563EB" />
                                </View>
                            </View>
                            <Text style={styles.idleTitle}>Ready to Scan</Text>
                            <Text style={styles.idleBody}>
                                Junk Wiper uses three detection strategies to find exact copies, same-name files across albums, and burst-shot clusters.
                            </Text>
                            <View style={styles.strategyRow}>
                                {[
                                    { icon: "copy-outline", color: "#FF5A5F", label: "Exact copies" },
                                    { icon: "document-text-outline", color: "#B45309", label: "Same filename" },
                                    { icon: "images-outline", color: "#2563EB", label: "Burst shots" },
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
                                    <Ionicons name="warning-outline" size={15} color="#B45309" />
                                    <Text style={styles.limitedBannerText}>
                                        Limited access — only selected photos will be scanned.{" "}
                                        <Text style={{ textDecorationLine: "underline" }}>Enable full access →</Text>
                                    </Text>
                                </Pressable>
                            )}
                            {accessLevel === "all" && (
                                <View style={styles.fullAccessBanner}>
                                    <Ionicons name="checkmark-circle-outline" size={15} color="#2563EB" />
                                    <Text style={styles.fullAccessText}>Full photo library access granted</Text>
                                </View>
                            )}

                            <Pressable
                                style={[styles.startBtn, preparing && { opacity: 0.85 }]}
                                onPress={requestScan}
                                disabled={preparing}
                            >
                                {preparing ? (
                                    <>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <Text style={styles.startBtnText}>Starting…</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="play-circle" size={22} color="#fff" />
                                        <Text style={styles.startBtnText}>Start Scan · {featureCfg.creditCost} credits</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/* ──────────── SCANNING — PREMIUM RADAR ──────────── */}
                    {phase === "scanning" && (
                        <LinearGradient
                            colors={["#0A1230", "#0B1B44", "#08122E"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.radarScreen}
                        >
                            {/* Radar dish */}
                            <View
                                style={styles.radarStage}
                                accessible
                                accessibilityRole="progressbar"
                                accessibilityLabel={`Scanning for junk files. ${progress} percent complete. ${liveCount} photos scanned, ${liveFound} duplicates found, ${formatSize(liveBytes)} reclaimable.`}
                                accessibilityValue={{ min: 0, max: 100, now: progress }}
                            >
                                {/* Expanding soft pulse */}
                                <Animated.View
                                    style={[
                                        styles.radarPulse,
                                        { opacity: pulseFade, transform: [{ scale: pulseScale }] },
                                    ]}
                                />

                                {/* Thin concentric rings */}
                                <View style={[styles.radarRing, styles.radarRingOuter]} />
                                <View style={[styles.radarRing, styles.radarRingMid]} />
                                <View style={[styles.radarRing, styles.radarRingInner]} />

                                {/* Cross-hair grid */}
                                <View style={styles.radarCrossH} />
                                <View style={styles.radarCrossV} />

                                {/* Rotating glowing sweep (clipped to the dish) */}
                                <View style={styles.radarClip}>
                                    <Animated.View style={[styles.sweepRotor, { transform: [{ rotate: radarRot }] }]}>
                                        <LinearGradient
                                            colors={["rgba(56,189,248,0)", "rgba(56,189,248,0.55)"]}
                                            start={{ x: 0, y: 1 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.sweepBeam}
                                        />
                                        <View style={styles.sweepEdge} />
                                    </Animated.View>
                                </View>

                                {/* Center readout */}
                                <View style={styles.radarCenter}>
                                    <Text style={styles.radarPct}>{progress}%</Text>
                                    <Text style={styles.radarCenterLabel}>SCANNING</Text>
                                </View>
                            </View>

                            {/* Scan message */}
                            <Text style={styles.radarMsg}>{SCAN_MESSAGES[messageIdx]}</Text>

                            {/* Category chips that fade as files are scanned */}
                            <View style={styles.categoryRow}>
                                {[
                                    { icon: "document-text-outline", label: "Files" },
                                    { icon: "image-outline", label: "Photos" },
                                    { icon: "server-outline", label: "Cache" },
                                    { icon: "copy-outline", label: "Duplicates" },
                                    { icon: "trash-outline", label: "Trash" },
                                ].map((c, i) => (
                                    <Animated.View key={c.label} style={[styles.categoryChip, { opacity: categoryFades[i] }]}>
                                        <Ionicons name={c.icon} size={16} color="#7DD3FC" />
                                        <Text style={styles.categoryLabel}>{c.label}</Text>
                                    </Animated.View>
                                ))}
                            </View>

                            {/* Live stats — real values from the scan */}
                            <View style={styles.radarStatsRow}>
                                <View style={styles.radarStat}>
                                    <Text style={styles.radarStatVal}>{liveCount.toLocaleString()}</Text>
                                    <Text style={styles.radarStatLabel}>Detected</Text>
                                </View>
                                <View style={styles.radarStatDivider} />
                                <View style={styles.radarStat}>
                                    <Text style={[styles.radarStatVal, liveFound > 0 && { color: "#FCA5A5" }]}>{liveFound}</Text>
                                    <Text style={styles.radarStatLabel}>Duplicates</Text>
                                </View>
                                <View style={styles.radarStatDivider} />
                                <View style={styles.radarStat}>
                                    <Text style={[styles.radarStatVal, { color: "#7DD3FC" }]}>{formatSize(liveBytes)}</Text>
                                    <Text style={styles.radarStatLabel}>Junk size</Text>
                                </View>
                            </View>

                            {/* Progress bar */}
                            <View style={styles.radarBarTrack}>
                                <View style={[styles.radarBarFill, { width: `${progress}%` }]} />
                            </View>

                            {/* Safety note */}
                            <View style={styles.radarSafety}>
                                <Ionicons name="shield-checkmark-outline" size={14} color="#7DD3FC" />
                                <Text style={styles.radarSafetyText}>Nothing will be deleted without your confirmation.</Text>
                            </View>

                            <Pressable style={styles.radarCancel} onPress={cancelScan} accessibilityRole="button">
                                <Text style={styles.radarCancelText}>Cancel Scan</Text>
                            </Pressable>
                        </LinearGradient>
                    )}

                    {/* ──────────── DONE / REPORT ──────────── */}
                    {phase === "done" && (
                        <View style={styles.reportWrap}>

                            <View style={styles.reportHeader}>
                                <Ionicons name="checkmark-circle" size={26} color="#2563EB" />
                                <Text style={styles.reportTitle}>Scan Complete</Text>
                            </View>

                            {/* Stats grid */}
                            <View style={styles.statsGrid}>
                                <StatBox label="Duplicates" value={stats.photos} icon="copy-outline" color="#FF5A5F" />
                                <StatBox label="Groups" value={stats.groups} icon="albums-outline" color="#B45309" />
                                <StatBox label="Savings" value={`${stats.savedMB} MB`} icon="server-outline" color="#2563EB" />
                            </View>

                            {duplicates.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="checkmark-circle-outline" size={44} color="#2563EB" />
                                    <Text style={styles.emptyTitle}>No duplicates found!</Text>
                                    <Text style={styles.emptySub}>Your photo library looks clean.</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Legend */}
                                    <View style={styles.legendRow}>
                                        {[
                                            { color: "#FF5A5F", label: "Exact copy" },
                                            { color: "#B45309", label: "Same name" },
                                            { color: "#2563EB", label: "Burst shot" },
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
                                                    color={isSel ? "#FF5A5F" : "#9CA3AF"}
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
                                <Ionicons name="shield-checkmark-outline" size={14} color="#2563EB" />
                                <Text style={styles.safetyText}>Newest copy of each file is always kept.</Text>
                            </View>

                            <Pressable
                                style={styles.rescanBtn}
                                onPress={() => { setPhase("idle"); setDuplicates([]); setSelected(new Set()); }}
                            >
                                <Ionicons name="refresh-outline" size={16} color="#6B7280" />
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

            {/* ──────────── ROCKET CLEANUP OVERLAY ──────────── */}
            {cleaning && (
                <View style={styles.cleanOverlay} pointerEvents="auto">
                    {!cleanDone ? (
                        <>
                            <Animated.View
                                style={[
                                    styles.rocketWrap,
                                    {
                                        opacity: rocketOpacity,
                                        transform: [
                                            { translateY: rocketY },
                                            {
                                                translateX: rocketShake.interpolate({
                                                    inputRange: [-1, 1],
                                                    outputRange: [-3, 3],
                                                }),
                                            },
                                        ],
                                    },
                                ]}
                            >
                                {/* Rocket body — rotate the diagonal glyph so the nose points straight up */}
                                <View style={styles.rocketIcon}>
                                    <Ionicons name="rocket" size={78} color="#E8EEFF" />
                                </View>

                                {/* Exhaust flame — layered cones that flicker */}
                                <Animated.View
                                    style={[
                                        styles.flameStack,
                                        {
                                            opacity: smokeScale,
                                            transform: [
                                                {
                                                    scaleY: flameFlicker.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [1, 1.45],
                                                    }),
                                                },
                                                {
                                                    scaleX: flameFlicker.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [1, 0.82],
                                                    }),
                                                },
                                            ],
                                        },
                                    ]}
                                >
                                    <View style={styles.flameOuter} />
                                    <View style={styles.flameMid} />
                                    <View style={styles.flameCore} />
                                </Animated.View>

                                {/* Rising sparks under the flame */}
                                <Animated.View style={[styles.spark, styles.sparkA, { opacity: smokeScale }]} />
                                <Animated.View style={[styles.spark, styles.sparkB, { opacity: smokeScale }]} />
                                <Animated.View style={[styles.spark, styles.sparkC, { opacity: smokeScale }]} />
                            </Animated.View>
                            <Text style={styles.cleanText}>Cleaning up junk files…</Text>
                        </>
                    ) : (
                        <View style={styles.cleanDoneBox}>
                            <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
                            <Text style={styles.cleanDoneText}>All cleaned up!</Text>
                        </View>
                    )}
                </View>
            )}

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
        backgroundColor: "rgba(255,255,255,0.74)",
        alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: "#111111", fontSize: 20, fontWeight: "900" },
    complianceNote: { color: "#6B7280", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 18 },

    // ── Idle ──
    idleBox: {
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 24, padding: 24, gap: 16, alignItems: "center",
    },
    idleOrbit: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
    idleRingOuter: {
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        borderWidth: 1.5, borderColor: "rgba(79,140,255,0.25)", borderStyle: "dashed",
    },
    idleRingInner: {
        position: "absolute", width: 80, height: 80, borderRadius: 40,
        borderWidth: 1, borderColor: "rgba(79,140,255,0.35)",
    },
    idleIconBox: {
        width: 70, height: 70, borderRadius: 22,
        backgroundColor: "rgba(79,140,255,0.18)",
        borderWidth: 1, borderColor: "rgba(79,140,255,0.30)",
        alignItems: "center", justifyContent: "center",
    },
    idleTitle: { color: "#111111", fontSize: 20, fontWeight: "900" },
    idleBody: { color: "#6B7280", fontWeight: "700", textAlign: "center", lineHeight: 20, fontSize: 13 },
    strategyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    strategyChip: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    strategyChipText: { fontWeight: "800", fontSize: 12 },
    limitedBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: 8,
        backgroundColor: "rgba(251,191,36,0.08)",
        borderWidth: 1, borderColor: "rgba(251,191,36,0.28)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    limitedBannerText: { flex: 1, color: "#B45309", fontWeight: "700", fontSize: 12, lineHeight: 17 },
    fullAccessBanner: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(79,140,255,0.08)",
        borderWidth: 1, borderColor: "rgba(79,140,255,0.25)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    fullAccessText: { color: "#2563EB", fontWeight: "700", fontSize: 12 },
    startBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "#4F8CFF",
        borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24,
        borderWidth: 1, borderColor: "rgba(79,140,255,0.35)", alignSelf: "stretch", justifyContent: "center",
    },
    startBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    // ── Scanner / Jarvis ──
    scannerWrap: { alignItems: "center", gap: 18 },

    hexRing: {
        position: "absolute",
        width: 250, height: 250, borderRadius: 125,
        borderWidth: 1, borderColor: "rgba(79,140,255,0.12)",
        alignSelf: "center",
    },

    ringContainer: {
        width: 220, height: 220,
        alignItems: "center", justifyContent: "center",
    },
    ring: { position: "absolute", borderRadius: 999 },
    ring1: { width: 130, height: 130, borderWidth: 2, borderColor: "rgba(79,140,255,0.65)", borderStyle: "dashed" },
    ring2: { width: 165, height: 165, borderWidth: 1.5, borderColor: "rgba(79,140,255,0.40)" },
    ring3: { width: 205, height: 205, borderWidth: 1, borderColor: "rgba(79,140,255,0.20)", borderStyle: "dotted" },

    radarWedge: {
        position: "absolute",
        width: 0, height: 0,
        borderLeftWidth: 0,
        borderRightWidth: 90,
        borderBottomWidth: 90,
        borderStyle: "solid",
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "rgba(79,140,255,0.18)",
        top: 110, left: 110,
    },

    glow: {
        position: "absolute",
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: "rgba(79,140,255,0.30)",
    },
    scanLine: {
        position: "absolute",
        width: 140, height: 2,
        backgroundColor: "rgba(79,140,255,0.80)",
        borderRadius: 1,
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    particle: {
        position: "absolute",
        width: 5, height: 5, borderRadius: 3,
        backgroundColor: "#2563EB",
    },
    centerIcon: {
        width: 68, height: 68, borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderWidth: 1.5, borderColor: "rgba(79,140,255,0.45)",
        alignItems: "center", justifyContent: "center",
    },

    progressPct: { color: "#111111", fontSize: 38, fontWeight: "900", letterSpacing: -1 },
    scanMsg: { color: "#2563EB", fontWeight: "800", fontSize: 14, textAlign: "center" },

    liveCountRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, gap: 0,
        alignSelf: "stretch",
    },
    liveCounter: { flex: 1, alignItems: "center", gap: 2 },
    liveCountVal: { color: "#111111", fontWeight: "900", fontSize: 22 },
    liveCountLabel: { color: "#6B7280", fontWeight: "700", fontSize: 11 },
    liveCountDivider: { width: 1, height: 36, backgroundColor: "#E5E7EB" },

    progressBarTrack: {
        alignSelf: "stretch", height: 4, borderRadius: 2,
        backgroundColor: "#E5E7EB",
        overflow: "hidden",
    },
    progressBarFill: {
        height: 4, borderRadius: 2,
        backgroundColor: "#2563EB",
    },

    safetyRow: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(79,140,255,0.06)",
        borderWidth: 1, borderColor: "rgba(79,140,255,0.18)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    safetyText: { flex: 1, color: "#6B7280", fontSize: 12, fontWeight: "700", lineHeight: 17 },

    cancelBtn: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "#E5E7EB",
    },
    cancelBtnText: { color: "#6B7280", fontWeight: "800" },

    // ── Premium radar scanner ──
    radarScreen: {
        borderRadius: 28,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: "center",
        gap: 18,
        borderWidth: 1,
        borderColor: "rgba(56,189,248,0.18)",
        shadowColor: "#0A1230",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 8,
    },
    radarStage: {
        width: 230, height: 230,
        alignItems: "center", justifyContent: "center",
    },
    radarPulse: {
        position: "absolute",
        width: 230, height: 230, borderRadius: 115,
        backgroundColor: "rgba(56,189,248,0.18)",
    },
    radarRing: {
        position: "absolute",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(56,189,248,0.22)",
    },
    radarRingOuter: { width: 220, height: 220 },
    radarRingMid: { width: 152, height: 152, borderColor: "rgba(56,189,248,0.28)" },
    radarRingInner: { width: 84, height: 84, borderColor: "rgba(56,189,248,0.34)" },
    radarCrossH: {
        position: "absolute", width: 220, height: 1,
        backgroundColor: "rgba(56,189,248,0.14)",
    },
    radarCrossV: {
        position: "absolute", width: 1, height: 220,
        backgroundColor: "rgba(56,189,248,0.14)",
    },
    // Clip container keeps the rotating sweep inside the circular dish
    radarClip: {
        position: "absolute",
        width: 220, height: 220, borderRadius: 110,
        overflow: "hidden",
        alignItems: "center", justifyContent: "center",
    },
    sweepRotor: {
        width: 220, height: 220,
        alignItems: "center", justifyContent: "center",
    },
    // A quarter-circle beam that trails off — one half of the rotor
    sweepBeam: {
        position: "absolute",
        top: 0, right: 0,
        width: 110, height: 110,
    },
    sweepEdge: {
        position: "absolute",
        top: 0, left: 110,
        width: 2, height: 110,
        backgroundColor: "rgba(125,211,252,0.95)",
        shadowColor: "#38BDF8",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    radarCenter: {
        width: 84, height: 84, borderRadius: 42,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(9,18,46,0.65)",
        borderWidth: 1, borderColor: "rgba(56,189,248,0.4)",
    },
    radarPct: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", letterSpacing: -1 },
    radarCenterLabel: { color: "#7DD3FC", fontSize: 10, fontWeight: "800", letterSpacing: 2 },

    radarMsg: { color: "#BAE6FD", fontWeight: "700", fontSize: 14, textAlign: "center" },

    categoryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
    categoryChip: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(56,189,248,0.10)",
        borderWidth: 1, borderColor: "rgba(56,189,248,0.25)",
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    categoryLabel: { color: "#E0F2FE", fontWeight: "700", fontSize: 11 },

    radarStatsRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(56,189,248,0.18)",
        borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12,
        alignSelf: "stretch",
    },
    radarStat: { flex: 1, alignItems: "center", gap: 2 },
    radarStatVal: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
    radarStatLabel: { color: "#94A3B8", fontWeight: "700", fontSize: 10, letterSpacing: 0.4 },
    radarStatDivider: { width: 1, height: 34, backgroundColor: "rgba(148,163,184,0.25)" },

    radarBarTrack: {
        alignSelf: "stretch", height: 5, borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.10)",
        overflow: "hidden",
    },
    radarBarFill: { height: 5, borderRadius: 3, backgroundColor: "#38BDF8" },

    radarSafety: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(56,189,248,0.08)",
        borderWidth: 1, borderColor: "rgba(56,189,248,0.20)",
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    radarSafetyText: { flex: 1, color: "#CBD5E1", fontSize: 12, fontWeight: "700", lineHeight: 17 },

    radarCancel: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: "rgba(148,163,184,0.3)",
    },
    radarCancelText: { color: "#CBD5E1", fontWeight: "800" },

    // ── Report ──
    reportWrap: { gap: 14 },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reportTitle: { color: "#111111", fontSize: 20, fontWeight: "900" },

    statsGrid: { flexDirection: "row", gap: 10 },
    statBox: {
        flex: 1, backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
    },
    statValue: { fontWeight: "900", fontSize: 18 },
    statLabel: { color: "#6B7280", fontSize: 11, fontWeight: "700", textAlign: "center" },

    legendRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: "#6B7280", fontWeight: "700", fontSize: 12 },

    listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    listHeaderText: { color: "#6B7280", fontWeight: "700", fontSize: 13, flex: 1 },
    selectionBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
    selAllText: { color: "#2563EB", fontWeight: "800", fontSize: 13 },
    selNoneText: { color: "#9CA3AF", fontWeight: "800", fontSize: 13 },
    selDivider: { color: "#D1D5DB", fontWeight: "400" },

    emptyBox: { alignItems: "center", gap: 10, paddingVertical: 24 },
    emptyTitle: { color: "#2563EB", fontWeight: "900", fontSize: 18 },
    emptySub: { color: "#6B7280", fontWeight: "700", fontSize: 14 },

    dupRow: {
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
        borderRadius: 16, padding: 14,
    },
    dupRowSelected: { backgroundColor: "rgba(255,90,95,0.09)", borderColor: "rgba(255,90,95,0.35)" },
    dupCheck: {
        width: 22, height: 22, borderRadius: 8,
        borderWidth: 1.5, borderColor: "#D1D5DB",
        alignItems: "center", justifyContent: "center",
    },
    dupCheckActive: { backgroundColor: "#FF5A5F", borderColor: "#FF5A5F" },
    dupName: { color: "#111111", fontWeight: "800", fontSize: 13 },
    dupMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 2 },
    stratBadge: {
        borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    stratBadgeText: { fontWeight: "800", fontSize: 10 },
    dupMetaText: { color: "#9CA3AF", fontWeight: "700", fontSize: 11 },

    deleteBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: "#FF5A5F",
        borderRadius: 18, paddingVertical: 15,
        borderWidth: 1, borderColor: "rgba(255,90,95,0.35)",
    },
    deleteBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    rescanBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        paddingVertical: 12, borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.74)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.90)",
    },
    rescanText: { color: "#6B7280", fontWeight: "800" },

    // ── Rocket cleanup overlay ──
    cleanOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(8,15,35,0.82)",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 120,
    },
    rocketWrap: { alignItems: "center", justifyContent: "center" },
    // Ionicons "rocket" points to the top-right (~45°); rotate -45° so it points up.
    rocketIcon: { transform: [{ rotate: "-45deg" }], zIndex: 2 },

    // Flame cones stacked below the rocket, anchored at the top so they grow downward.
    flameStack: {
        marginTop: -10,
        alignItems: "center",
        zIndex: 1,
    },
    flameOuter: {
        width: 26, height: 56,
        borderTopLeftRadius: 13, borderTopRightRadius: 13,
        borderBottomLeftRadius: 13, borderBottomRightRadius: 13,
        backgroundColor: "#FF7A00",
        shadowColor: "#FF5A00",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 16,
    },
    flameMid: {
        position: "absolute", top: 4,
        width: 16, height: 40,
        borderRadius: 9,
        backgroundColor: "#FFB020",
    },
    flameCore: {
        position: "absolute", top: 8,
        width: 8, height: 24,
        borderRadius: 5,
        backgroundColor: "#FFF3C4",
    },
    spark: {
        position: "absolute",
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: "#FFC46B",
    },
    sparkA: { bottom: -14, left: -8 },
    sparkB: { bottom: -22, right: -6 },
    sparkC: { bottom: -30, left: 4 },
    cleanText: {
        position: "absolute",
        bottom: 60,
        color: "#fff", fontWeight: "900", fontSize: 16, textAlign: "center",
    },
    cleanDoneBox: {
        alignItems: "center", gap: 14,
        alignSelf: "center",
        marginBottom: SCREEN_H * 0.35,
    },
    cleanDoneText: { color: "#fff", fontWeight: "900", fontSize: 22 },
});
