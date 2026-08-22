/**
 * SignatureScreen — draw a signature, place it on a page, add text boxes,
 * export a PDF and share it.
 *
 * Entirely on-device: no credits, no network. Route params:
 *   { imageUri?: string, title?: string }
 * With no imageUri the user picks a page first.
 *
 * Export path: the page is embedded as a base64 <img>, the signature as an inline
 * SVG <path>, and expo-print renders the HTML to PDF — so the signature stays
 * vector-crisp at any zoom rather than being a screenshot of the editor.
 *
 * IMPORTANT: the copy here must never claim legal validity. This produces a
 * signature *image* on a document, not a certified e-signature.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Pressable,
    Modal,
    Alert,
    Image,
    TextInput,
    ScrollView,
    PanResponder,
    ActivityIndicator,
    StyleSheet,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import GradientScreen from "../ui/GradientScreen";
import SignaturePad, { strokesToSvg, renderStroke } from "../ui/SignaturePad";
import { listSignatures, saveSignature, deleteSignature } from "../services/signatureStore";
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";

const SCREEN_W = Dimensions.get("window").width;
const PAGE_W = SCREEN_W - 32;
// Fallback frame (A4) used only before a page is chosen.
const DEFAULT_ASPECT = 1 / 1.414; // width / height
// Very tall images are capped so the editor still fits on screen; the frame is
// narrowed to match so its aspect always equals the image's.
const MAX_PAGE_H = PAGE_W * 1.7;

const MIN_SIG_W = 70;

/**
 * The frame MUST have the same aspect ratio as the page image.
 *
 * The exported PDF renders the image at width:100% with automatic height and no
 * letterboxing, and every overlay is positioned as a percentage of that box. If
 * the on-screen frame were a fixed A4 rectangle with the image letterboxed
 * inside it, those percentages would describe a different box than the PDF's and
 * the signature would land somewhere else vertically on export.
 */
function frameFor(aspect) {
    const a = aspect && isFinite(aspect) && aspect > 0 ? aspect : DEFAULT_ASPECT;
    let w = PAGE_W;
    let h = PAGE_W / a;
    if (h > MAX_PAGE_H) {
        h = MAX_PAGE_H;
        w = MAX_PAGE_H * a;
    }
    return { w, h };
}

export default function SignatureScreen({ navigation, route }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [pageUri, setPageUri] = useState(route?.params?.imageUri || null);
    // width / height of the chosen page image, measured via Image.getSize.
    const [pageAspect, setPageAspect] = useState(null);
    const [saved, setSaved] = useState([]);
    const [padOpen, setPadOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    // The signature currently placed on the page.
    const [placed, setPlaced] = useState(null); // { strokes, x, y, width, aspect }
    // Text boxes dropped on the page.
    const [boxes, setBoxes] = useState([]); // { id, text, x, y }
    const [editingBox, setEditingBox] = useState(null);

    const padRef = useRef(null);
    const [padStrokes, setPadStrokes] = useState([]);

    const refreshSaved = useCallback(async () => {
        setSaved(await listSignatures());
    }, []);

    useEffect(() => {
        refreshSaved();
    }, [refreshSaved]);

    // Measure the page so the editor frame matches it exactly (see frameFor).
    useEffect(() => {
        if (!pageUri) {
            setPageAspect(null);
            return;
        }
        let alive = true;
        Image.getSize(
            pageUri,
            (w, h) => {
                if (alive && h > 0) setPageAspect(w / h);
            },
            () => {
                // Unreadable dimensions — fall back to A4 rather than blocking.
                if (alive) setPageAspect(null);
            }
        );
        return () => {
            alive = false;
        };
    }, [pageUri]);

    const frame = useMemo(() => frameFor(pageAspect), [pageAspect]);

    // ── Page selection ────────────────────────────────────────────────────────
    async function pickPage() {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert(
                "Photo Access Needed",
                "Allow photo access so you can choose the page you want to sign."
            );
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.9,
        });
        if (!res.canceled && res.assets?.[0]?.uri) setPageUri(res.assets[0].uri);
    }

    // ── Signature capture ─────────────────────────────────────────────────────
    function openPad() {
        setPadStrokes([]);
        setPadOpen(true);
    }

    function placeStrokes(strokes) {
        const svg = strokesToSvg(strokes);
        if (!svg) return;
        const width = Math.min(200, frame.w * 0.5);
        setPlaced({
            strokes,
            x: (frame.w - width) / 2,
            y: frame.h * 0.72,
            width,
            aspect: svg.aspect,
        });
    }

    async function confirmPad(alsoSave) {
        const strokes = padRef.current?.getStrokes?.() || [];
        if (strokes.length === 0) {
            Alert.alert("Nothing drawn", "Draw your signature first.");
            return;
        }
        if (alsoSave) {
            await saveSignature(strokes);
            await refreshSaved();
        }
        placeStrokes(strokes);
        setPadOpen(false);
    }

    function useSaved(sig) {
        placeStrokes(sig.strokes);
    }

    function removeSaved(sig) {
        Alert.alert("Delete signature?", "This saved signature will be removed.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await deleteSignature(sig.id);
                    await refreshSaved();
                },
            },
        ]);
    }

    // ── Text boxes ────────────────────────────────────────────────────────────
    function addTextBox() {
        const box = { id: `t_${Date.now()}`, text: "Text", x: frame.w * 0.15, y: frame.h * 0.3 };
        setBoxes((b) => [...b, box]);
        setEditingBox(box);
    }

    function updateBox(id, patch) {
        setBoxes((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    }

    function removeBox(id) {
        setBoxes((b) => b.filter((x) => x.id !== id));
    }

    // ── Export ────────────────────────────────────────────────────────────────
    async function exportPdf() {
        if (!pageUri) {
            Alert.alert("No page", "Choose the page you want to sign first.");
            return;
        }
        if (!placed && boxes.length === 0) {
            Alert.alert("Nothing to add", "Add your signature or a text box before exporting.");
            return;
        }

        setExporting(true);
        try {
            const base64 = await FileSystem.readAsStringAsync(pageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const mime = mimeForUri(pageUri);

            // Everything is positioned in percentages of the page frame, so the
            // PDF matches what the user arranged on screen at any output size.
            const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;

            let overlay = "";

            if (placed) {
                const sig = strokesToSvg(placed.strokes, { color: "#111111" });
                if (sig) {
                    const h = placed.width / placed.aspect;
                    overlay += `<div style="position:absolute;left:${pct(placed.x, frame.w)};top:${pct(
                        placed.y,
                        frame.h
                    )};width:${pct(placed.width, frame.w)};height:${pct(h, frame.h)};">${sig.svg}</div>`;
                }
            }

            for (const b of boxes) {
                overlay += `<div style="position:absolute;left:${pct(b.x, frame.w)};top:${pct(
                    b.y,
                    frame.h
                )};font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13pt;color:#111;">${escapeHtml(
                    b.text
                )}</div>`;
            }

            const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { margin: 0; }
  html,body { margin:0; padding:0; }
  .page { position:relative; width:100%; }
  .page img { display:block; width:100%; }
</style></head><body>
  <div class="page">
    <img src="data:${mime};base64,${base64}" />
    ${overlay}
  </div>
</body></html>`;

            const { uri } = await Print.printToFileAsync({ html });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: "application/pdf",
                    dialogTitle: "Share signed document",
                    UTI: "com.adobe.pdf",
                });
            } else {
                Alert.alert("Saved", "The signed PDF was created but sharing is unavailable on this device.");
            }
        } catch (err) {
            Alert.alert("Export Failed", err?.message || "Could not create the PDF. Please try again.");
        } finally {
            setExporting(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <GradientScreen>
            <SafeAreaView style={styles.flex}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Upload"))}
                        hitSlop={16}
                        style={{ padding: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
                    </Pressable>
                    <View style={styles.flex1}>
                        <Text style={styles.title} numberOfLines={1}>
                            {route?.params?.title || "Sign Document"}
                        </Text>
                        <Text style={styles.subtitle}>Free · stays on your device</Text>
                    </View>
                    <Pressable
                        onPress={exportPdf}
                        disabled={exporting}
                        style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Export as PDF and share"
                    >
                        {exporting ? (
                            <ActivityIndicator size="small" color={theme.colors.white} />
                        ) : (
                            <>
                                <Ionicons name="share-outline" size={15} color={theme.colors.white} />
                                <Text style={styles.exportText}>Save</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* Page canvas — sized to the image's own aspect ratio */}
                    <View style={[styles.page, { width: frame.w, height: frame.h }]}>
                        {pageUri ? (
                            <Image source={{ uri: pageUri }} style={styles.pageImg} resizeMode="contain" />
                        ) : (
                            <Pressable onPress={pickPage} style={styles.pagePlaceholder} accessibilityRole="button">
                                <Ionicons name="image-outline" size={34} color={theme.colors.textMuted} />
                                <Text style={styles.placeholderTitle}>Choose a page to sign</Text>
                                <Text style={styles.placeholderSub}>Pick a photo or scan of your document</Text>
                            </Pressable>
                        )}

                        {/* Placed signature */}
                        {placed && (
                            <DraggableSignature
                                placed={placed}
                                onChange={setPlaced}
                                onRemove={() => setPlaced(null)}
                                frame={frame}
                                theme={theme}
                            />
                        )}

                        {/* Text boxes */}
                        {boxes.map((b) => (
                            <DraggableBox
                                key={b.id}
                                box={b}
                                onChange={(patch) => updateBox(b.id, patch)}
                                onEdit={() => setEditingBox(b)}
                                onRemove={() => removeBox(b.id)}
                                frame={frame}
                                theme={theme}
                            />
                        ))}
                    </View>

                    {/* Toolbar */}
                    <View style={styles.toolbar}>
                        <ToolButton icon="create-outline" label="Draw" onPress={openPad} />
                        <ToolButton icon="text-outline" label="Add text" onPress={addTextBox} />
                        <ToolButton icon="image-outline" label={pageUri ? "Change page" : "Pick page"} onPress={pickPage} />
                    </View>

                    {/* Saved signatures */}
                    {saved.length > 0 && (
                        <View style={styles.savedWrap}>
                            <Text style={styles.sectionLabel}>Saved signatures</Text>
                            <View style={styles.savedRow}>
                                {saved.map((s) => (
                                    <Pressable
                                        key={s.id}
                                        onPress={() => useSaved(s)}
                                        onLongPress={() => removeSaved(s)}
                                        style={styles.savedChip}
                                        accessibilityRole="button"
                                        accessibilityLabel="Use saved signature. Long press to delete."
                                    >
                                        <MiniSignature strokes={s.strokes} color={theme.colors.textPrimary} />
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.hint}>Tap to place · long-press to delete</Text>
                        </View>
                    )}

                    {/* Legal honesty — this is a signature image, not a certified e-signature. */}
                    <View style={styles.disclaimer}>
                        <Ionicons name="information-circle-outline" size={15} color={theme.colors.textMuted} />
                        <Text style={styles.disclaimerText}>
                            This adds a signature image to your document. It is not a certified or
                            legally binding e-signature.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Draw pad */}
            <Modal visible={padOpen} animationType="slide" transparent onRequestClose={() => setPadOpen(false)}>
                <View style={styles.padOverlay}>
                    <View style={styles.padSheet}>
                        <View style={styles.padHead}>
                            <Text style={styles.padTitle}>Draw your signature</Text>
                            <Pressable onPress={() => setPadOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                            </Pressable>
                        </View>

                        <View style={styles.padFrame}>
                            <SignaturePad ref={padRef} onChange={setPadStrokes} style={styles.pad} />
                            <View style={styles.padBaseline} pointerEvents="none" />
                        </View>

                        <View style={styles.padActions}>
                            <Pressable onPress={() => padRef.current?.undo?.()} style={styles.padGhost} accessibilityRole="button">
                                <Ionicons name="arrow-undo-outline" size={16} color={theme.colors.textSecondary} />
                                <Text style={styles.padGhostText}>Undo</Text>
                            </Pressable>
                            <Pressable onPress={() => padRef.current?.clear?.()} style={styles.padGhost} accessibilityRole="button">
                                <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
                                <Text style={styles.padGhostText}>Clear</Text>
                            </Pressable>
                        </View>

                        <Pressable
                            onPress={() => confirmPad(true)}
                            disabled={padStrokes.length === 0}
                            style={[styles.padPrimary, padStrokes.length === 0 && { opacity: 0.45 }]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.padPrimaryText}>Save & Place</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmPad(false)} disabled={padStrokes.length === 0} accessibilityRole="button">
                            <Text style={[styles.padSecondaryText, padStrokes.length === 0 && { opacity: 0.45 }]}>
                                Use once, don't save
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Text box editor */}
            <Modal visible={!!editingBox} animationType="fade" transparent onRequestClose={() => setEditingBox(null)}>
                <Pressable style={styles.padOverlay} onPress={() => setEditingBox(null)}>
                    <Pressable style={styles.textSheet} onPress={() => {}}>
                        <Text style={styles.padTitle}>Edit text</Text>
                        <TextInput
                            value={editingBox?.text ?? ""}
                            onChangeText={(t) => {
                                setEditingBox((b) => ({ ...b, text: t }));
                                updateBox(editingBox.id, { text: t });
                            }}
                            autoFocus
                            placeholder="Type here"
                            placeholderTextColor={theme.colors.placeholder}
                            keyboardAppearance={theme.keyboardAppearance}
                            style={styles.textInput}
                        />
                        <Pressable onPress={() => setEditingBox(null)} style={styles.padPrimary} accessibilityRole="button">
                            <Text style={styles.padPrimaryText}>Done</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </GradientScreen>
    );
}

/* ── Draggable + resizable signature ─────────────────────────────────────────*/

function DraggableSignature({ placed, onChange, onRemove, frame, theme }) {
    const start = useRef({ x: 0, y: 0, width: 0 });

    // A PanResponder is created ONCE and never re-created, so anything its
    // handlers close over is frozen at first render. Reading current props
    // through a ref instead is what keeps the second and every later gesture
    // from snapping the signature back to where it first appeared.
    const live = useRef({ placed, onChange, frame });
    live.current = { placed, onChange, frame };

    const drag = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
            // Without these the surrounding ScrollView steals any vertical drag,
            // so the page scrolls instead of the item moving.
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,
            onPanResponderGrant: () => {
                const p = live.current.placed;
                start.current = { x: p.x, y: p.y, width: p.width };
            },
            onPanResponderMove: (_, g) => {
                const { placed: p, frame: f } = live.current;
                const h = start.current.width / p.aspect;
                live.current.onChange({
                    ...p,
                    x: clamp(start.current.x + g.dx, 0, f.w - start.current.width),
                    y: clamp(start.current.y + g.dy, 0, f.h - h),
                });
            },
        })
    ).current;

    const resize = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,
            onPanResponderGrant: () => {
                const p = live.current.placed;
                start.current = { x: p.x, y: p.y, width: p.width };
            },
            onPanResponderMove: (_, g) => {
                const { placed: p, frame: f } = live.current;
                const width = clamp(
                    start.current.width + g.dx,
                    MIN_SIG_W,
                    f.w - start.current.x
                );
                live.current.onChange({ ...p, width });
            },
        })
    ).current;

    const height = placed.width / placed.aspect;

    return (
        <View
            style={{
                position: "absolute",
                left: placed.x,
                top: placed.y,
                width: placed.width,
                height,
            }}
        >
            <View
                {...drag.panHandlers}
                style={{
                    flex: 1,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: theme.colors.primary,
                    borderRadius: 4,
                }}
            >
                <MiniSignature strokes={placed.strokes} color={theme.colors.black} fill />
            </View>

            {/* Remove */}
            <Pressable
                onPress={onRemove}
                hitSlop={8}
                style={[handleStyle(theme), { left: -11, top: -11, backgroundColor: theme.colors.danger }]}
                accessibilityRole="button"
                accessibilityLabel="Remove signature"
            >
                <Ionicons name="close" size={13} color={theme.colors.white} />
            </Pressable>

            {/* Resize */}
            <View
                {...resize.panHandlers}
                style={[handleStyle(theme), { right: -11, bottom: -11, backgroundColor: theme.colors.primary }]}
                accessibilityLabel="Resize signature"
            >
                <Ionicons name="resize-outline" size={13} color={theme.colors.white} />
            </View>
        </View>
    );
}

function DraggableBox({ box, onChange, onEdit, onRemove, frame, theme }) {
    const start = useRef({ x: 0, y: 0 });
    const gesture = useRef({ startedAt: 0, moved: 0 });
    const [size, setSize] = useState({ w: 60, h: 24 });

    // Same frozen-closure trap as DraggableSignature — see the note there.
    const live = useRef({ box, onChange, onEdit, frame, size });
    live.current = { box, onChange, onEdit, frame, size };

    // A plain View, NOT a Pressable. Pressable installs its own responder
    // handlers which override the ones panHandlers spreads in, so the drag
    // never activates and the box sits frozen in place. Tap-vs-drag is
    // therefore decided here, in onPanResponderRelease.
    const drag = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
            // Stop the surrounding ScrollView stealing vertical drags.
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,

            onPanResponderGrant: () => {
                const b = live.current.box;
                start.current = { x: b.x, y: b.y };
                gesture.current = { startedAt: Date.now(), moved: 0 };
            },

            onPanResponderMove: (_, g) => {
                const { frame: f, size: sz } = live.current;
                gesture.current.moved = Math.max(
                    gesture.current.moved,
                    Math.abs(g.dx) + Math.abs(g.dy)
                );
                live.current.onChange({
                    x: clamp(start.current.x + g.dx, 0, Math.max(0, f.w - sz.w)),
                    y: clamp(start.current.y + g.dy, 0, Math.max(0, f.h - sz.h)),
                });
            },

            onPanResponderRelease: () => {
                // A short touch that barely moved is a tap → open the editor.
                const { startedAt, moved } = gesture.current;
                if (moved < 6 && Date.now() - startedAt < 400) {
                    live.current.onEdit();
                }
            },
        })
    ).current;

    return (
        <View style={{ position: "absolute", left: box.x, top: box.y }}>
            <View
                {...drag.panHandlers}
                onLayout={(e) =>
                    setSize({
                        w: e.nativeEvent.layout.width,
                        h: e.nativeEvent.layout.height,
                    })
                }
                style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: theme.colors.primary,
                    borderRadius: 4,
                    backgroundColor: "rgba(255,255,255,0.55)",
                }}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={`Text box: ${box.text}. Drag to move, tap to edit.`}
            >
                <Text style={{ color: theme.colors.black, fontSize: 13, fontWeight: "600" }}>
                    {box.text || "Text"}
                </Text>
            </View>

            {/* Explicit remove handle. Long-press is deliberately NOT used for
                delete here — holding is how the user starts a drag. */}
            <Pressable
                onPress={onRemove}
                hitSlop={10}
                style={[handleStyle(theme), { right: -10, top: -10, backgroundColor: theme.colors.danger }]}
                accessibilityRole="button"
                accessibilityLabel="Remove text box"
            >
                <Ionicons name="close" size={12} color={theme.colors.white} />
            </Pressable>
        </View>
    );
}

/**
 * MiniSignature — renders stroke data scaled into whatever box it is given,
 * reusing the same rotated-segment technique as the pad.
 */
function MiniSignature({ strokes, color, fill }) {
    const [size, setSize] = useState({ w: 0, h: 0 });

    const bounds = useMemo(() => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of strokes || []) {
            for (const p of s) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        }
        return isFinite(minX) ? { minX, minY, w: maxX - minX || 1, h: maxY - minY || 1 } : null;
    }, [strokes]);

    if (!bounds) return null;

    const pad = 4;
    const scale =
        size.w && size.h
            ? Math.min((size.w - pad * 2) / bounds.w, (size.h - pad * 2) / bounds.h)
            : 0;

    // Shift the ink to the origin, then centre it in the available box.
    const offset = {
        x: -bounds.minX * scale + (size.w - bounds.w * scale) / 2,
        y: -bounds.minY * scale + (size.h - bounds.h * scale) / 2,
    };

    return (
        <View
            style={{
                flex: fill ? 1 : undefined,
                width: fill ? undefined : "100%",
                height: fill ? undefined : "100%",
            }}
            onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
            {scale > 0 &&
                (strokes || []).map((stroke, si) =>
                    renderStroke(stroke, {
                        color,
                        width: Math.max(1.5, 3 * scale),
                        scale,
                        offset,
                        keyPrefix: `m${si}`,
                    })
                )}
        </View>
    );
}

function ToolButton({ icon, label, onPress }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.tool, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Ionicons name={icon} size={18} color={theme.colors.accentText} />
            <Text style={styles.toolText}>{label}</Text>
        </Pressable>
    );
}

/* ── helpers ────────────────────────────────────────────────────────────────*/

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function mimeForUri(uri) {
    const ext = String(uri).split("?")[0].split(".").pop()?.toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "heic" || ext === "heif") return "image/heic";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function handleStyle(theme) {
    return {
        position: "absolute",
        width: 22,
        height: 22,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: theme.colors.white,
    };
}

const makeStyles = (t) =>
    StyleSheet.create({
        flex: { flex: 1 },
        flex1: { flex: 1, minWidth: 0 },

        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        title: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 17 },
        subtitle: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11.5, marginTop: 1 },

        exportBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
            minWidth: 78,
            justifyContent: "center",
        },
        exportText: { color: t.colors.white, fontWeight: "900", fontSize: 13 },

        scroll: { paddingHorizontal: 16, paddingBottom: 40 },

        page: {
            alignSelf: "center",
            borderRadius: t.radius.lg,
            overflow: "hidden",
            backgroundColor: t.colors.white,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        pageImg: { width: "100%", height: "100%" },
        pagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
        placeholderTitle: { color: t.colors.black, fontWeight: "800", fontSize: 15 },
        placeholderSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12 },

        toolbar: { flexDirection: "row", gap: 10, marginTop: 14 },
        tool: {
            flex: 1,
            alignItems: "center",
            gap: 6,
            paddingVertical: 13,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        toolText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 12 },

        savedWrap: { marginTop: 20 },
        sectionLabel: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 13, marginBottom: 10 },
        savedRow: { flexDirection: "row", gap: 10 },
        savedChip: {
            width: 96,
            height: 54,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
            overflow: "hidden",
        },
        hint: { color: t.colors.textMuted, fontWeight: "600", fontSize: 11, marginTop: 8 },

        disclaimer: {
            flexDirection: "row",
            gap: 8,
            marginTop: 22,
            padding: 12,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.glassSoft,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        disclaimerText: { flex: 1, color: t.colors.textMuted, fontWeight: "600", fontSize: 11.5, lineHeight: 16 },

        padOverlay: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: "flex-end" },
        padSheet: {
            backgroundColor: t.colors.sheet,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 18,
            paddingBottom: 34,
            gap: 12,
        },
        padHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        padTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },

        padFrame: {
            height: 190,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.white,
            borderWidth: 1,
            borderColor: t.colors.border,
            overflow: "hidden",
        },
        // The pad draws in black on white so it looks like ink on paper in both themes.
        pad: { flex: 1 },
        padBaseline: {
            position: "absolute",
            left: 24,
            right: 24,
            bottom: 46,
            height: 1,
            backgroundColor: "rgba(0,0,0,0.14)",
        },

        padActions: { flexDirection: "row", gap: 10 },
        padGhost: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 11,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        padGhostText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 13 },

        padPrimary: {
            paddingVertical: 14,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.primary,
            alignItems: "center",
        },
        padPrimaryText: { color: t.colors.white, fontWeight: "900", fontSize: 15 },
        padSecondaryText: {
            color: t.colors.textMuted,
            fontWeight: "700",
            fontSize: 13,
            textAlign: "center",
            paddingVertical: 4,
        },

        textSheet: {
            margin: 24,
            marginTop: "auto",
            marginBottom: "auto",
            backgroundColor: t.colors.sheet,
            borderRadius: 18,
            padding: 18,
            gap: 14,
        },
        textInput: {
            color: t.colors.textPrimary,
            backgroundColor: t.colors.inputBg,
            borderWidth: 1,
            borderColor: t.colors.inputBorder,
            borderRadius: t.radius.md,
            paddingHorizontal: 12,
            paddingVertical: 11,
            fontSize: 15,
            fontWeight: "600",
        },
    });
