import React, { useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { View, PanResponder, StyleSheet } from "react-native";

import { useTheme } from "./ThemeProvider";

/**
 * SignaturePad — finger-drawing surface with zero native dependencies.
 *
 * Why not react-native-svg: it is a native module, so adding it would force a new
 * dev-client/EAS build. Instead each stroke segment is drawn as a thin rotated
 * <View> between consecutive touch points. At 2–3px width the joins are invisible
 * and a signature is only a few hundred segments, so the cost is negligible.
 *
 * For EXPORT the raw points are converted to a real SVG <path> (see strokesToSvg
 * below) and embedded in the print HTML — so the PDF gets crisp vector output,
 * not a bitmap of rotated views.
 *
 * Ref API: { clear(), undo(), isEmpty(), getStrokes() }
 */

const STROKE_WIDTH = 3;

/**
 * Renders one stroke as a chain of thin rotated views.
 *
 * Each segment is positioned CENTRED on the midpoint of its two points and then
 * rotated. React Native rotates about a view's centre by default, so this needs
 * no `transformOrigin` at all — relying on that property was why strokes came
 * out as horizontal bars: when the origin is not applied, every segment rotates
 * about the wrong point and the visible result collapses to horizontal dashes.
 *
 * `scale` and `offset` let a saved signature be redrawn inside a smaller box.
 */
export function renderStroke(stroke, { color, width = STROKE_WIDTH, scale = 1, offset = { x: 0, y: 0 }, keyPrefix = "s" }) {
    const out = [];

    for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1];
        const b = stroke[i];

        const ax = a.x * scale + offset.x;
        const ay = a.y * scale + offset.y;
        const bx = b.x * scale + offset.x;
        const by = b.y * scale + offset.y;

        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) continue;

        const angle = Math.atan2(dy, dx);
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;

        // A little overlap so consecutive segments join without gaps on curves.
        const w = length + width * 0.5;

        out.push(
            <View
                key={`${keyPrefix}-${i}`}
                pointerEvents="none"
                style={{
                    position: "absolute",
                    left: midX - w / 2,
                    top: midY - width / 2,
                    width: w,
                    height: width,
                    borderRadius: width,
                    backgroundColor: color,
                    transform: [{ rotate: `${angle}rad` }],
                }}
            />
        );
    }

    return out;
}
// Points closer together than this are dropped — keeps the view count sane
// without any visible loss of fidelity.
const MIN_DISTANCE = 1.6;

const SignaturePad = forwardRef(function SignaturePad(
    { strokeColor, onChange, style },
    ref
) {
    const { theme } = useTheme();
    const color = strokeColor || theme.colors.textPrimary;

    // Committed strokes (finished) + the one currently under the finger.
    const [strokes, setStrokes] = useState([]);
    const [current, setCurrent] = useState([]);
    const currentRef = useRef([]);
    // The PanResponder below is created once, so it cannot read `strokes` from
    // the render closure — it would be frozen at []. This ref is the live copy.
    const strokesRef = useRef([]);

    const push = useCallback((next) => {
        currentRef.current = next;
        setCurrent(next);
    }, []);

    // The PanResponder below is created once and cannot see later closures.
    const measureRef = useRef(null);
    const toLocalRef = useRef(null);

    // Where the pad sits in the window, so window-space touches can be converted
    // to pad-space. Measured on layout — see the note on toLocal below.
    const originRef = useRef({ x: 0, y: 0 });
    const viewRef = useRef(null);

    const measure = useCallback(() => {
        viewRef.current?.measureInWindow?.((x, y) => {
            originRef.current = { x: x || 0, y: y || 0 };
        });
    }, []);

    /**
     * Converts a touch to pad-local coordinates.
     *
     * nativeEvent.locationX/locationY are NOT reliable here: during a move they
     * are reported relative to whichever view currently holds the touch, which
     * differs between iOS and Android and breaks outright once the pad has
     * children. pageX/pageY are always window-space, so subtracting the pad's
     * measured origin gives a stable local point on both platforms.
     */
    const toLocal = useCallback((e) => {
        const { pageX, pageY } = e.nativeEvent;
        return {
            x: pageX - originRef.current.x,
            y: pageY - originRef.current.y,
        };
    }, []);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            // Capture phase too, so no ancestor can claim the touch first.
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            // Keep the gesture even if a parent ScrollView wants it.
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,

            onPanResponderGrant: (e) => {
                // Re-measure at touch time: the modal may have animated into
                // place after the initial onLayout fired.
                measureRef.current?.();
                push([toLocalRef.current(e)]);
            },

            onPanResponderMove: (e) => {
                const pt = toLocalRef.current(e);
                const pts = currentRef.current;
                const last = pts[pts.length - 1];
                if (last) {
                    const dx = pt.x - last.x;
                    const dy = pt.y - last.y;
                    if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) return;
                }
                push([...pts, pt]);
            },

            onPanResponderRelease: () => {
                const pts = currentRef.current;

                // A tap becomes a two-point dot so a full stop still registers.
                const stroke =
                    pts.length > 1
                        ? pts
                        : pts.length === 1
                            ? [pts[0], { x: pts[0].x + 0.5, y: pts[0].y + 0.5 }]
                            : null;

                if (stroke) {
                    // Built outside the updater: React state updaters must be
                    // pure, and calling onChange (a parent setState) from inside
                    // one triggers a cross-component update warning and can fire
                    // twice under StrictMode.
                    const next = [...strokesRef.current, stroke];
                    strokesRef.current = next;
                    setStrokes(next);
                    onChange?.(next);
                }

                push([]);
            },
        })
    ).current;

    useImperativeHandle(ref, () => ({
        clear() {
            strokesRef.current = [];
            setStrokes([]);
            push([]);
            onChange?.([]);
        },
        undo() {
            const next = strokesRef.current.slice(0, -1);
            strokesRef.current = next;
            setStrokes(next);
            onChange?.(next);
        },
        isEmpty() {
            return strokesRef.current.length === 0;
        },
        getStrokes() {
            return strokesRef.current;
        },
    }));

    measureRef.current = measure;
    toLocalRef.current = toLocal;

    const all = current.length > 1 ? [...strokes, current] : strokes;

    return (
        <View
            ref={viewRef}
            onLayout={measure}
            {...panResponder.panHandlers}
            style={[styles.surface, style]}
            // The pad is a drawing canvas — announce it rather than letting
            // VoiceOver read it as an empty container.
            accessibilityLabel="Signature drawing area"
            accessibilityHint="Draw your signature with one finger"
        >
            {all.map((stroke, si) =>
                renderStroke(stroke, { color, keyPrefix: `k${si}` })
            )}
        </View>
    );
});

/**
 * Convert captured strokes into an SVG path + viewBox, trimmed to the ink's
 * bounding box so the exported signature has no dead margin around it.
 * Returns null when there is nothing drawn.
 */
export function strokesToSvg(strokes, { strokeWidth = STROKE_WIDTH, color = "#111111" } = {}) {
    if (!strokes || strokes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
        for (const p of s) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
    }
    if (!isFinite(minX)) return null;

    const pad = strokeWidth;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + pad * 2);

    const d = strokes
        .map((s) =>
            s
                .map((p, i) => {
                    const x = (p.x - minX + pad).toFixed(2);
                    const y = (p.y - minY + pad).toFixed(2);
                    return `${i === 0 ? "M" : "L"}${x} ${y}`;
                })
                .join(" ")
        )
        .join(" ");

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h.toFixed(2)}" ` +
        `width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" ` +
        `stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    return { svg, width: w, height: h, aspect: w / h };
}

const styles = StyleSheet.create({
    surface: { overflow: "hidden" },
});

export default SignaturePad;
