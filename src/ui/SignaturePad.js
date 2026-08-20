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

    const push = useCallback((next) => {
        currentRef.current = next;
        setCurrent(next);
    }, []);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            // Keep the gesture even if a parent ScrollView wants it.
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: (e) => {
                const { locationX, locationY } = e.nativeEvent;
                push([{ x: locationX, y: locationY }]);
            },

            onPanResponderMove: (e) => {
                const { locationX, locationY } = e.nativeEvent;
                const pts = currentRef.current;
                const last = pts[pts.length - 1];
                if (last) {
                    const dx = locationX - last.x;
                    const dy = locationY - last.y;
                    if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) return;
                }
                push([...pts, { x: locationX, y: locationY }]);
            },

            onPanResponderRelease: () => {
                const pts = currentRef.current;
                if (pts.length > 1) {
                    setStrokes((prev) => {
                        const next = [...prev, pts];
                        onChange?.(next);
                        return next;
                    });
                } else if (pts.length === 1) {
                    // A tap — render it as a dot so a full stop still registers.
                    const p = pts[0];
                    setStrokes((prev) => {
                        const next = [...prev, [p, { x: p.x + 0.5, y: p.y + 0.5 }]];
                        onChange?.(next);
                        return next;
                    });
                }
                push([]);
            },
        })
    ).current;

    useImperativeHandle(ref, () => ({
        clear() {
            setStrokes([]);
            push([]);
            onChange?.([]);
        },
        undo() {
            setStrokes((prev) => {
                const next = prev.slice(0, -1);
                onChange?.(next);
                return next;
            });
        },
        isEmpty() {
            return strokes.length === 0;
        },
        getStrokes() {
            return strokes;
        },
    }));

    const all = current.length > 1 ? [...strokes, current] : strokes;

    return (
        <View
            {...panResponder.panHandlers}
            style={[styles.surface, style]}
            // The pad is a drawing canvas — announce it rather than letting
            // VoiceOver read it as an empty container.
            accessibilityLabel="Signature drawing area"
            accessibilityHint="Draw your signature with one finger"
        >
            {all.map((stroke, si) =>
                stroke.slice(1).map((pt, i) => {
                    const prev = stroke[i];
                    const dx = pt.x - prev.x;
                    const dy = pt.y - prev.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);
                    return (
                        <View
                            key={`${si}-${i}`}
                            pointerEvents="none"
                            style={{
                                position: "absolute",
                                left: prev.x,
                                top: prev.y - STROKE_WIDTH / 2,
                                width: length + STROKE_WIDTH * 0.6,
                                height: STROKE_WIDTH,
                                borderRadius: STROKE_WIDTH,
                                backgroundColor: color,
                                transform: [
                                    { translateX: -STROKE_WIDTH * 0.3 },
                                    { rotateZ: `${angle}rad` },
                                ],
                                // Rotate about the segment's start, not its centre.
                                transformOrigin: `${STROKE_WIDTH * 0.3}px ${STROKE_WIDTH / 2}px`,
                            }}
                        />
                    );
                })
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
