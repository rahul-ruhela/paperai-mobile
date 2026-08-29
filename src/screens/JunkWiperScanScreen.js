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
import CleanupCelebration from "../ui/CleanupCelebration";
import { reserveCredits, completeTransaction, refundTransaction, getFeatureConfig } from "../api/credits";
import { listDocuments, deleteDocument } from "../api/documents";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import { showEntitlementDenial } from "../ui/FeatureLock";
import { usePhotoPermission } from "../hooks/usePhotoPermission";
import {
    buildDocumentDuplicateGroups,
    buildDuplicateGroups,
    enrichAssets,
    enumerateAssets,
    formatSize,
    isVideoAsset,
} from "../services/cleanerService";
// ── Duplicate Cleaner — the duplicate scan screen ─────────────────────────────
//
// The file, the route name ("JunkWiper") and the entitlement key (deep_clean)
// all keep their original names so existing navigate() calls and entitlement
// lookups are untouched. Only what the user READS changed: this screen and
// Storage Studio's "Duplicate Cleaner" have always been the same feature, and
// showing two names for it made people look for a second one that isn't there.
// This is the Basic Cleaner from docs/smart-cleaner-spec.md, and the entry point
// Storage Studio hands off to for duplicates. It owns permission, the credit
// reservation, the review list and deletion.
//
// It no longer owns the detection. The four strategies — exact size+dimensions,
// same filename, burst-shot neighbours, and duplicate PaperAI documents by title
// — live in services/cleanerService.js so the newer cleaner layers group photos
// with the same code rather than a copy of it. Read them there.
//
// Two things this screen will not do, both of them spec §7 and App Review
// guideline 2.3.1: it never deletes anything without an explicit in-app confirm
// followed by the OS sheet, and it never invents a finding. A clean library
// returns zero groups and renders the empty state.

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

// Report categories. "all" is always shown; the rest hide themselves when the
// scan found nothing of that kind.
const KIND_FILTERS = [
    { key: "all", label: "All", icon: "layers-outline" },
    { key: "photo", label: "Photos", icon: "image-outline" },
    { key: "video", label: "Videos", icon: "videocam-outline" },
    { key: "document", label: "Docs", icon: "document-text-outline" },
];

const { height: SCREEN_H } = Dimensions.get("window");


export default function JunkWiperScanScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [phase, setPhase] = useState("idle");
    const [messageIdx, setMessageIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [liveCount, setLiveCount] = useState(0);
    const [liveFound, setLiveFound] = useState(0);
    const [liveBytes, setLiveBytes] = useState(0);
    const [stats, setStats] = useState({ photos: 0, groups: 0, savedMB: 0 });
    const [duplicates, setDuplicates] = useState([]);
    const [kindFilter, setKindFilter] = useState("all");
    const [selected, setSelected] = useState(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    // Rocket cleanup animation shown while junk is being wiped
    const [cleaning, setCleaning] = useState(false);
    const [cleanDone, setCleanDone] = useState(false);
    // Set only when a delete actually reclaimed space, so the rocket can
    // never celebrate a cleanup that freed nothing.
    const [celebration, setCelebration] = useState(null);
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
    const { ensureAccess, permissionSheet } = usePhotoPermission();
    const [confirmModal, setConfirmModal] = useState({ visible: false, loading: false });
    const [featureCfg, setFeatureCfg] = useState({
        creditCost: 3,
        userNoticeTitle: "Start Duplicate Scan",
        userNoticeMessage:
            "Duplicate Cleaner scans the photos, videos and PaperAI documents you allow, and reports duplicate copies. Nothing is deleted automatically — you review and confirm before anything is removed.",
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
        let privilege;
        try {
            // The explainer runs first and always ends at the system dialog.
            // Previously this called requestPermissionsAsync() cold and only
            // explained itself in the Alert that followed a refusal — which iOS
            // gives no way to act on, since the dialog is shown exactly once.
            privilege = await ensureAccess({
                title: "Duplicate Cleaner needs your photos",
                reason:
                    "Duplicate Cleaner compares the photos in your library on this device to find exact copies, repeated filenames and burst shots. It works best with access to all photos.",
            });
        } finally {
            setPreparing(false);
        }

        // The sheet has already said where the user stands — a second Alert on
        // top of it would just be the same message twice.
        if (!privilege) return;
        setAccessLevel(privilege);

        if (privilege === "limited") {
            // User gave limited access — let them expand selection first
            Alert.alert(
                "Limited Photo Access",
                "You've only allowed access to selected photos. For Duplicate Cleaner to find all duplicates it needs access to your full photo library.\n\nChoose an option:",
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
            if (showEntitlementDenial(e, navigation, "deep_clean")) return;

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

        try {
            const groups = await findDuplicates(
                (scanned) => setLiveCount(scanned),
                (found) => setLiveFound(found),
                (pct) => setProgress(pct),
                (bytes) => setLiveBytes(bytes),
            );

            stopAnimations();
            setProgress(100);

            // Report exactly what the scan found. Never synthesise placeholder
            // "junk" to make the result look productive: the user pays credits
            // for this scan, and inventing findings that delete nothing is both
            // dishonest and an App Review rejection (guideline 2.3.1 accurate
            // functionality / 5.6 code of conduct). A clean library legitimately
            // returns zero groups and renders the empty state below.
            const finalGroups = groups;

            const totalBytes = finalGroups.reduce((acc, g) => acc + g.totalBytes, 0);
            setStats({
                photos: finalGroups.reduce((acc, g) => acc + g.count, 0),
                groups: finalGroups.length,
                savedMB: parseFloat((totalBytes / 1024 / 1024).toFixed(1)),
            });
            setDuplicates(finalGroups);

            // The scan itself is the paid service, so it is charged whenever it
            // runs to completion — including a clean library that legitimately
            // returns zero groups. Credits come back only when the scan fails or
            // the user cancels it (see the catch below and cancelScan).
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

    // ── Duplicate detection ────────────────────────────────────────────────────
    // The strategies themselves now live in services/cleanerService.js, so the
    // Storage Studio layers group photos with exactly the same code this screen
    // does instead of a second copy that drifts. This function is only the
    // orchestration: page, enrich, group, then fold in the document duplicates.
    async function findDuplicates(onScanned, onFound, onProgress, onBytes) {
        const assets = await enumerateAssets({
            onCount: (n) => {
                onScanned(n);
                // 0–55% while enumerating. The library size is unknown until the
                // last page, so this is a paced bar rather than a true fraction —
                // it never claims to be at 100% before the work is done.
                onProgress(Math.min(55, Math.round((n / Math.max(n + 1, 1)) * 55)));
            },
        });

        onProgress(60);

        const enriched = await enrichAssets(assets, {
            onProgress: (fraction) => onProgress(60 + Math.round(fraction * 30)),
        });

        onProgress(92);

        const groups = buildDuplicateGroups(enriched, {
            isVideo: isVideoAsset,
            onGroup: (built) => {
                onFound?.(built.length);
                onBytes?.(built.reduce((acc, g) => acc + g.totalBytes, 0));
            },
        });

        onProgress(96);

        // Duplicate PaperAI documents, via the existing GET /api/documents. A
        // failure here reports the media results we do have rather than failing
        // the whole scan the user just paid for.
        try {
            groups.push(...buildDocumentDuplicateGroups(await listDocuments()));
            onFound?.(groups.length);
        } catch {
            // Offline, or the documents call failed.
        }

        onProgress(100);
        onFound(groups.length);

        return groups.sort((a, b) => b.totalBytes - a.totalBytes);
    }


    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    // Rows currently on screen for the chosen category.
    const visibleDuplicates =
        kindFilter === "all" ? duplicates : duplicates.filter(d => d.kind === kindFilter);

    // Select/deselect act on the visible category only, so "All" inside Photos
    // never silently marks documents for deletion too.
    function selectAll() {
        setSelected(prev => {
            const next = new Set(prev);
            visibleDuplicates.forEach(d => next.add(d.id));
            return next;
        });
    }
    function deselectAll() {
        setSelected(prev => {
            const next = new Set(prev);
            visibleDuplicates.forEach(d => next.delete(d.id));
            return next;
        });
    }

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
            const assetIds = selectedItems.flatMap(d => d.assetIds ?? []);
            const docIds = selectedItems.flatMap(d => d.docIds ?? []);

            // Every row maps to something real, so the OS delete dialog and the
            // storage the user is told they reclaimed refer to the same files.
            if (assetIds.length > 0) {
                await MediaLibrary.deleteAssetsAsync(assetIds);
            }

            // Documents go through the existing DELETE /api/documents/{id}.
            // Collect failures instead of aborting: a half-finished delete that
            // throws would leave the list claiming rows were removed when they
            // weren't.
            const failedDocs = [];
            for (const id of docIds) {
                try {
                    await deleteDocument(id);
                } catch {
                    failedDocs.push(id);
                }
            }

            const failedSet = new Set(failedDocs);
            const remaining = duplicates.filter(d => {
                if (!selected.has(d.id)) return true;
                // Keep any document group whose deletions did not all succeed.
                return (d.docIds ?? []).some(id => failedSet.has(id));
            });

            if (failedDocs.length > 0) {
                Alert.alert(
                    "Some documents kept",
                    `${failedDocs.length} document${failedDocs.length === 1 ? "" : "s"} could not be deleted and ${failedDocs.length === 1 ? "is" : "are"} still listed. Please try again.`
                );
            }

            // Bytes are only known for media. Deleted documents have no size we
            // can honestly report, so they get no figure rather than a made-up
            // one — the same rule the completion alert below already follows.
            const freedBytes = assetIds.length > 0
                ? selectedItems.reduce((acc, d) => acc + (d.totalBytes ?? 0), 0)
                : 0;

            // Show the "cleaned up!" confirmation for a beat before tearing down.
            setCleanDone(true);
            setTimeout(() => {
                setDuplicates(remaining);
                setSelected(new Set());
                setCleaning(false);
                setCleanDone(false);
                setDeleting(false);

                // The rocket replaces the "All Done!" alert when space was
                // actually reclaimed and nothing failed — an alert you have to
                // dismiss is a poor reward for finishing a cleanup. The alert
                // still carries the cases the rocket cannot state honestly.
                if (failedDocs.length === 0 && freedBytes > 0) {
                    setCelebration(formatSize(freedBytes));
                } else if (remaining.length === 0) {
                    Alert.alert(
                        "✓ All Done!",
                        assetIds.length > 0
                            ? "Duplicates removed. The space they used on your device has been freed up."
                            : "Duplicate documents removed from your PaperAI library."
                    );
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
        if (strategy === "exact") return { label: "Exact copy", color: theme.colors.danger };
        if (strategy === "name") return { label: "Same name", color: theme.colors.warningText };
        if (strategy === "document") return { label: "Document", color: theme.colors.success };
        if (strategy === "cache") return { label: "System junk", color: theme.colors.textMuted };
        return { label: "Burst shot", color: theme.colors.accentText };
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={20} color={theme.colors.accentText} />
                        </Pressable>
                        <Text style={styles.headerTitle}>Duplicate Cleaner</Text>
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
                                    <Ionicons name="search" size={36} color={theme.colors.accentText} />
                                </View>
                            </View>
                            <Text style={styles.idleTitle}>Ready to Scan</Text>
                            <Text style={styles.idleBody}>
                                Duplicate Cleaner finds duplicate photos, videos and PaperAI
                                documents — exact copies, the same file saved across
                                albums, burst-shot clusters, and documents uploaded twice.
                            </Text>
                            <View style={styles.strategyRow}>
                                {[
                                    { icon: "copy-outline", color: theme.colors.danger, label: "Exact copies" },
                                    { icon: "document-text-outline", color: theme.colors.warningText, label: "Same filename" },
                                    { icon: "images-outline", color: theme.colors.accentText, label: "Burst shots" },
                                    { icon: "documents-outline", color: theme.colors.success, label: "Documents" },
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
                                    <Ionicons name="warning-outline" size={15} color={theme.colors.warningText} />
                                    <Text style={styles.limitedBannerText}>
                                        Limited access — only selected photos will be scanned.{" "}
                                        <Text style={{ textDecorationLine: "underline" }}>Enable full access →</Text>
                                    </Text>
                                </Pressable>
                            )}
                            {accessLevel === "all" && (
                                <View style={styles.fullAccessBanner}>
                                    <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.accentText} />
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
                                        <ActivityIndicator size="small" color={theme.colors.white} />
                                        <Text style={styles.startBtnText}>Starting…</Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="play-circle" size={22} color={theme.colors.white} />
                                        <Text style={styles.startBtnText}>Start Scan · {featureCfg.creditCost} credits</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/* ──────────── SCANNING — PREMIUM RADAR ──────────── */}
                    {phase === "scanning" && (
                        <LinearGradient
                            colors={theme.gradients.radar}
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
                                            colors={[theme.colors.radarSweepFrom, theme.colors.radarSweepTo]}
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
                                        <Ionicons name={c.icon} size={16} color={theme.colors.radarAccent} />
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
                                    <Text style={[styles.radarStatVal, liveFound > 0 && { color: theme.colors.radarWarn }]}>{liveFound}</Text>
                                    <Text style={styles.radarStatLabel}>Duplicates</Text>
                                </View>
                                <View style={styles.radarStatDivider} />
                                <View style={styles.radarStat}>
                                    <Text style={[styles.radarStatVal, { color: theme.colors.radarAccent }]}>{formatSize(liveBytes)}</Text>
                                    <Text style={styles.radarStatLabel}>Junk size</Text>
                                </View>
                            </View>

                            {/* Progress bar */}
                            <View style={styles.radarBarTrack}>
                                <View style={[styles.radarBarFill, { width: `${progress}%` }]} />
                            </View>

                            {/* Safety note */}
                            <View style={styles.radarSafety}>
                                <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.radarAccent} />
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
                                <Ionicons name="checkmark-circle" size={26} color={theme.colors.accentText} />
                                <Text style={styles.reportTitle}>Scan Complete</Text>
                            </View>

                            {/* Stats grid */}
                            <View style={styles.statsGrid}>
                                <StatBox label="Duplicates" value={stats.photos} icon="copy-outline" color={theme.colors.danger} />
                                <StatBox label="Groups" value={stats.groups} icon="albums-outline" color={theme.colors.warningText} />
                                <StatBox label="Savings" value={`${stats.savedMB} MB`} icon="server-outline" color={theme.colors.accentText} />
                            </View>

                            {duplicates.length === 0 ? (
                                <View style={styles.emptyBox}>
                                    <Ionicons name="checkmark-circle-outline" size={44} color={theme.colors.accentText} />
                                    <Text style={styles.emptyTitle}>No duplicates found!</Text>
                                    <Text style={styles.emptySub}>
                                        Your photos, videos and documents look clean.
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {/* Category filter — Photos / Videos / Documents */}
                                    <View style={styles.kindRow}>
                                        {KIND_FILTERS.map(k => {
                                            const count =
                                                k.key === "all"
                                                    ? duplicates.length
                                                    : duplicates.filter(d => d.kind === k.key).length;
                                            if (k.key !== "all" && count === 0) return null;
                                            const active = kindFilter === k.key;
                                            return (
                                                <Pressable
                                                    key={k.key}
                                                    onPress={() => setKindFilter(k.key)}
                                                    accessibilityRole="tab"
                                                    accessibilityState={{ selected: active }}
                                                    style={[styles.kindChip, active && styles.kindChipActive]}
                                                >
                                                    <Ionicons
                                                        name={k.icon}
                                                        size={13}
                                                        color={active ? theme.colors.white : theme.colors.textMuted}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.kindChipText,
                                                            active && styles.kindChipTextActive,
                                                        ]}
                                                    >
                                                        {k.label} {count}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>

                                    {/* Legend */}
                                    <View style={styles.legendRow}>
                                        {[
                                            { color: theme.colors.danger, label: "Exact copy" },
                                            { color: theme.colors.warningText, label: "Same name" },
                                            { color: theme.colors.accentText, label: "Burst shot" },
                                            { color: theme.colors.success, label: "Document" },
                                        ].map(l => (
                                            <View key={l.label} style={styles.legendItem}>
                                                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                                                <Text style={styles.legendText}>{l.label}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.listHeader}>
                                        <Text style={styles.listHeaderText}>
                                            {visibleDuplicates.length} duplicate {visibleDuplicates.length === 1 ? "group" : "groups"} · tap to select
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

                                    {visibleDuplicates.map(item => {
                                        const badge = strategyBadge(item.strategy);
                                        const isSel = selected.has(item.id);
                                        return (
                                            <Pressable
                                                key={item.id}
                                                style={[styles.dupRow, isSel && styles.dupRowSelected]}
                                                onPress={() => toggleSelect(item.id)}
                                            >
                                                <View style={[styles.dupCheck, isSel && styles.dupCheckActive]}>
                                                    {isSel && <Ionicons name="checkmark" size={12} color={theme.colors.white} />}
                                                </View>
                                                <View style={{ flex: 1, gap: 3 }}>
                                                    <Text style={styles.dupName} numberOfLines={1}>{item.label}</Text>
                                                    <View style={styles.dupMetaRow}>
                                                        <View style={[styles.stratBadge, { borderColor: badge.color + "55" }]}>
                                                            <Text style={[styles.stratBadgeText, { color: badge.color }]}>{badge.label}</Text>
                                                        </View>
                                                        <Text style={styles.dupMetaText}>
                                                            {item.allCount} copies · remove {item.count}
                                                            {/* Documents have no size from the API, so no
                                                                savings figure is shown rather than "0 MB". */}
                                                            {item.saveMB > 0 ? ` · save ~${item.saveMB} MB` : ""}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Ionicons
                                                    name="trash-bin-outline" size={16}
                                                    color={isSel ? theme.colors.danger : theme.colors.placeholder}
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
                                            <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
                                            <Text style={styles.deleteBtnText}>
                                                {deleting ? "Deleting…" : `Delete ${selected.size} selected ${selected.size === 1 ? "group" : "groups"}`}
                                            </Text>
                                        </Pressable>
                                    )}
                                </>
                            )}

                            <View style={styles.safetyRow}>
                                <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.accentText} />
                                <Text style={styles.safetyText}>Newest copy of each file is always kept.</Text>
                            </View>

                            <Pressable
                                style={styles.rescanBtn}
                                onPress={() => { setPhase("idle"); setDuplicates([]); setSelected(new Set()); }}
                            >
                                <Ionicons name="refresh-outline" size={16} color={theme.colors.textMuted} />
                                <Text style={styles.rescanText}>Scan Again</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>

                <CleanupCelebration
                    visible={celebration != null}
                    bytesFreed={celebration ?? ""}
                    onDone={() => setCelebration(null)}
                />

                {permissionSheet}
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
                            <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
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
                safetyNote="Nothing is deleted without your confirmation. The scan uses credits each time it runs, including when your library is already clean and no duplicates are found."
            />
        </GradientScreen>
    );
}

function StatBox({ label, value, icon, color }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.statBox}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 18, gap: 16, paddingBottom: 48 },

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backBtn: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: t.colors.glass,
        alignItems: "center", justifyContent: "center",
    },
    headerTitle: { color: t.colors.textPrimary, fontSize: 20, fontWeight: "900" },
    complianceNote: { color: t.colors.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 18 },

    // ── Idle ──
    idleBox: {
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 24, padding: 24, gap: 16, alignItems: "center",
    },
    idleOrbit: { width: 110, height: 110, alignItems: "center", justifyContent: "center" },
    idleRingOuter: {
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        borderWidth: 1.5, borderColor: t.colors.infoBorder, borderStyle: "dashed",
    },
    idleRingInner: {
        position: "absolute", width: 80, height: 80, borderRadius: 40,
        borderWidth: 1, borderColor: t.colors.infoBorder,
    },
    idleIconBox: {
        width: 70, height: 70, borderRadius: 22,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        alignItems: "center", justifyContent: "center",
    },
    idleTitle: { color: t.colors.textPrimary, fontSize: 20, fontWeight: "900" },
    idleBody: { color: t.colors.textMuted, fontWeight: "700", textAlign: "center", lineHeight: 20, fontSize: 13 },
    strategyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    strategyChip: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    strategyChipText: { fontWeight: "800", fontSize: 12 },
    limitedBanner: {
        flexDirection: "row", alignItems: "flex-start", gap: 8,
        backgroundColor: t.colors.warningBg,
        borderWidth: 1, borderColor: t.colors.warningBorder,
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    limitedBannerText: { flex: 1, color: t.colors.warningText, fontWeight: "700", fontSize: 12, lineHeight: 17 },
    fullAccessBanner: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    fullAccessText: { color: t.colors.accentText, fontWeight: "700", fontSize: 12 },
    startBtn: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: t.colors.primary,
        borderRadius: 18, paddingVertical: 14, paddingHorizontal: 24,
        borderWidth: 1, borderColor: t.colors.infoBorder, alignSelf: "stretch", justifyContent: "center",
    },
    startBtnText: { color: t.colors.white, fontWeight: "900", fontSize: 15 },

    // ── Scanner / Jarvis ──
    scannerWrap: { alignItems: "center", gap: 18 },

    hexRing: {
        position: "absolute",
        width: 250, height: 250, borderRadius: 125,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        alignSelf: "center",
    },

    ringContainer: {
        width: 220, height: 220,
        alignItems: "center", justifyContent: "center",
    },
    ring: { position: "absolute", borderRadius: 999 },
    ring1: { width: 130, height: 130, borderWidth: 2, borderColor: t.colors.infoBorder, borderStyle: "dashed" },
    ring2: { width: 165, height: 165, borderWidth: 1.5, borderColor: t.colors.infoBorder },
    ring3: { width: 205, height: 205, borderWidth: 1, borderColor: t.colors.infoBorder, borderStyle: "dotted" },

    radarWedge: {
        position: "absolute",
        width: 0, height: 0,
        borderLeftWidth: 0,
        borderRightWidth: 90,
        borderBottomWidth: 90,
        borderStyle: "solid",
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: t.colors.infoBorder,
        top: 110, left: 110,
    },

    glow: {
        position: "absolute",
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: t.colors.infoBg,
    },
    scanLine: {
        position: "absolute",
        width: 140, height: 2,
        backgroundColor: "rgba(79,140,255,0.80)",
        borderRadius: 1,
        shadowColor: t.colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    particle: {
        position: "absolute",
        width: 5, height: 5, borderRadius: 3,
        backgroundColor: t.colors.primary,
    },
    centerIcon: {
        width: 68, height: 68, borderRadius: 22,
        backgroundColor: t.colors.surface,
        borderWidth: 1.5, borderColor: t.colors.infoBorder,
        alignItems: "center", justifyContent: "center",
    },

    progressPct: { color: t.colors.textPrimary, fontSize: 38, fontWeight: "900", letterSpacing: -1 },
    scanMsg: { color: t.colors.accentText, fontWeight: "800", fontSize: 14, textAlign: "center" },

    liveCountRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, gap: 0,
        alignSelf: "stretch",
    },
    liveCounter: { flex: 1, alignItems: "center", gap: 2 },
    liveCountVal: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 22 },
    liveCountLabel: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11 },
    liveCountDivider: { width: 1, height: 36, backgroundColor: t.colors.separator },

    progressBarTrack: {
        alignSelf: "stretch", height: 4, borderRadius: 2,
        backgroundColor: t.colors.separator,
        overflow: "hidden",
    },
    progressBarFill: {
        height: 4, borderRadius: 2,
        backgroundColor: t.colors.primary,
    },

    safetyRow: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    safetyText: { flex: 1, color: t.colors.textMuted, fontSize: 12, fontWeight: "700", lineHeight: 17 },

    cancelBtn: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16,
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.border,
    },
    cancelBtnText: { color: t.colors.textMuted, fontWeight: "800" },

    // ── Premium radar scanner ──
    radarScreen: {
        borderRadius: 28,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: "center",
        gap: 18,
        borderWidth: 1,
        borderColor: `rgba(${t.colors.radarTintRgb},0.18)`,
        shadowColor: t.colors.radarText,
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
        backgroundColor: `rgba(${t.colors.radarTintRgb},0.18)`,
    },
    radarRing: {
        position: "absolute",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: `rgba(${t.colors.radarTintRgb},0.22)`,
    },
    radarRingOuter: { width: 220, height: 220 },
    radarRingMid: { width: 152, height: 152, borderColor: `rgba(${t.colors.radarTintRgb},0.28)` },
    radarRingInner: { width: 84, height: 84, borderColor: `rgba(${t.colors.radarTintRgb},0.34)` },
    radarCrossH: {
        position: "absolute", width: 220, height: 1,
        backgroundColor: `rgba(${t.colors.radarTintRgb},0.14)`,
    },
    radarCrossV: {
        position: "absolute", width: 1, height: 220,
        backgroundColor: `rgba(${t.colors.radarTintRgb},0.14)`,
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
        borderWidth: 1, borderColor: `rgba(${t.colors.radarTintRgb},0.4)`,
    },
    radarPct: { color: t.colors.white, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
    radarCenterLabel: { color: t.colors.radarAccent, fontSize: 10, fontWeight: "800", letterSpacing: 2 },

    radarMsg: { color: "#BAE6FD", fontWeight: "700", fontSize: 14, textAlign: "center" },

    categoryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
    categoryChip: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: `rgba(${t.colors.radarTintRgb},0.10)`,
        borderWidth: 1, borderColor: `rgba(${t.colors.radarTintRgb},0.25)`,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    },
    categoryLabel: { color: "#E0F2FE", fontWeight: "700", fontSize: 11 },

    radarStatsRow: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: `rgba(${t.colors.radarTintRgb},0.18)`,
        borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12,
        alignSelf: "stretch",
    },
    radarStat: { flex: 1, alignItems: "center", gap: 2 },
    radarStatVal: { color: t.colors.radarText, fontWeight: "900", fontSize: 18 },
    radarStatLabel: { color: t.colors.radarMuted, fontWeight: "700", fontSize: 10, letterSpacing: 0.4 },
    radarStatDivider: { width: 1, height: 34, backgroundColor: t.colors.radarDivider },

    radarBarTrack: {
        alignSelf: "stretch", height: 5, borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.10)",
        overflow: "hidden",
    },
    radarBarFill: { height: 5, borderRadius: 3, backgroundColor: "#38BDF8" },

    radarSafety: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: `rgba(${t.colors.radarTintRgb},0.08)`,
        borderWidth: 1, borderColor: `rgba(${t.colors.radarTintRgb},0.20)`,
        borderRadius: 12, padding: 10, alignSelf: "stretch",
    },
    radarSafetyText: { flex: 1, color: "#CBD5E1", fontSize: 12, fontWeight: "700", lineHeight: 17 },

    radarCancel: {
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderColor: `rgba(${t.colors.radarTintRgb},0.3)`,
    },
    radarCancelText: { color: "#CBD5E1", fontWeight: "800" },

    // ── Report ──
    reportWrap: { gap: 14 },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reportTitle: { color: t.colors.textPrimary, fontSize: 20, fontWeight: "900" },

    statsGrid: { flexDirection: "row", gap: 10 },
    statBox: {
        flex: 1, backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
    },
    statValue: { fontWeight: "900", fontSize: 18 },
    statLabel: { color: t.colors.textMuted, fontSize: 11, fontWeight: "700", textAlign: "center" },

    kindRow: {
        flexDirection: "row",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 10,
    },
    kindChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        minHeight: 32,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.glassSoft,
    },
    kindChipActive: {
        backgroundColor: t.colors.primary,
        borderColor: t.colors.primary,
    },
    kindChipText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 11 },
    kindChipTextActive: { color: t.colors.white },

    legendRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 12 },

    listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    listHeaderText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 13, flex: 1 },
    selectionBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
    selAllText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },
    selNoneText: { color: t.colors.placeholder, fontWeight: "800", fontSize: 13 },
    selDivider: { color: t.colors.inputBorder, fontWeight: "400" },

    emptyBox: { alignItems: "center", gap: 10, paddingVertical: 24 },
    emptyTitle: { color: t.colors.accentText, fontWeight: "900", fontSize: 18 },
    emptySub: { color: t.colors.textMuted, fontWeight: "700", fontSize: 14 },

    dupRow: {
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 16, padding: 14,
    },
    dupRowSelected: { backgroundColor: t.colors.dangerBg, borderColor: t.colors.dangerBorder },
    dupCheck: {
        width: 22, height: 22, borderRadius: 8,
        borderWidth: 1.5, borderColor: t.colors.inputBorder,
        alignItems: "center", justifyContent: "center",
    },
    dupCheckActive: { backgroundColor: t.colors.danger, borderColor: t.colors.danger },
    dupName: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 13 },
    dupMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 2 },
    stratBadge: {
        borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    stratBadgeText: { fontWeight: "800", fontSize: 10 },
    dupMetaText: { color: t.colors.placeholder, fontWeight: "700", fontSize: 11 },

    deleteBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
        backgroundColor: t.colors.danger,
        borderRadius: 18, paddingVertical: 15,
        borderWidth: 1, borderColor: t.colors.dangerBorder,
    },
    deleteBtnText: { color: t.colors.white, fontWeight: "900", fontSize: 15 },

    rescanBtn: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        paddingVertical: 12, borderRadius: 14,
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
    },
    rescanText: { color: t.colors.textMuted, fontWeight: "800" },

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
        color: t.colors.white, fontWeight: "900", fontSize: 16, textAlign: "center",
    },
    cleanDoneBox: {
        alignItems: "center", gap: 14,
        alignSelf: "center",
        marginBottom: SCREEN_H * 0.35,
    },
    cleanDoneText: { color: t.colors.white, fontWeight: "900", fontSize: 22 },
});
