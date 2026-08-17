/**
 * Theme system for PaperAI — light / dark palettes with a user-selectable mode
 * that also reacts to the OS appearance.
 *
 * mode:   "system" | "light" | "dark"   (what the user picked, persisted)
 * scheme: "light" | "dark"              (the resolved scheme actually rendered)
 *
 * Usage in a screen/component:
 *   const { colors, scheme, mode, setMode } = useTheme();
 *   const styles = useMemo(() => makeStyles(colors), [colors]);
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

const MODE_KEY = "themeMode"; // persisted preference

// ── Palettes ────────────────────────────────────────────────────────────────
// Light mirrors the existing brand tokens; dark is the on-brand inverse.
const LIGHT = {
    scheme: "light",
    // page background gradient stops
    bgGradient: ["#F5F7FB", "#EEF2FB", "#F5F7FB"],
    bg: "#F5F7FB",
    // surfaces / glass cards
    surface: "#FFFFFF",
    glass: "rgba(255,255,255,0.74)",
    glassBorder: "rgba(255,255,255,0.90)",
    card: "rgba(255,255,255,0.74)",
    // text
    text: "#111111",
    text2: "#374151",
    muted: "#6B7280",
    // lines
    border: "#E5E7EB",
    inputBorder: "#D1D5DB",
    // brand + status (constant across themes)
    primary: "#4F8CFF",
    primaryDark: "#2563EB",
    link: "#2563EB",
    accent: "#FFD54A",
    danger: "#FF5A5F",
    dangerDark: "#DC2626",
    success: "#22C55E",
    warning: "#F59E0B",
    white: "#FFFFFF",
    // status bar content
    statusBar: "dark-content",
    // navigation chrome
    headerBg: "#F5F7FB",
    tabBarBg: "rgba(255,255,255,0.96)",
    isDark: false,
};

const DARK = {
    scheme: "dark",
    bgGradient: ["#0B1020", "#0E1530", "#0B1020"],
    bg: "#0B1020",
    surface: "#151B2E",
    glass: "rgba(255,255,255,0.06)",
    glassBorder: "rgba(255,255,255,0.12)",
    card: "rgba(255,255,255,0.06)",
    text: "#F3F5FA",
    text2: "#C7CEDC",
    muted: "#94A0B5",
    border: "rgba(255,255,255,0.12)",
    inputBorder: "rgba(255,255,255,0.20)",
    primary: "#6EA8FF",
    primaryDark: "#4F8CFF",
    link: "#7DD3FC",
    accent: "#FFD54A",
    danger: "#FF6B70",
    dangerDark: "#F87171",
    success: "#34D399",
    warning: "#FBBF24",
    white: "#FFFFFF",
    statusBar: "light-content",
    headerBg: "#0B1020",
    tabBarBg: "rgba(17,22,38,0.98)",
    isDark: true,
};

export function paletteFor(scheme) {
    return scheme === "dark" ? DARK : LIGHT;
}

const ThemeContext = createContext({
    mode: "system",
    scheme: "light",
    colors: LIGHT,
    setMode: () => {},
});

export function ThemeProvider({ children }) {
    const [mode, setModeState] = useState("system");
    const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() ?? "light");

    // Load the persisted preference once on mount.
    useEffect(() => {
        (async () => {
            try {
                const saved = await SecureStore.getItemAsync(MODE_KEY);
                if (saved === "light" || saved === "dark" || saved === "system") {
                    setModeState(saved);
                }
            } catch {
                /* fall back to "system" */
            }
        })();
    }, []);

    // React to OS appearance changes (only matters while mode === "system").
    useEffect(() => {
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemScheme(colorScheme ?? "light");
        });
        return () => sub.remove();
    }, []);

    const setMode = useCallback(async (next) => {
        setModeState(next);
        try {
            await SecureStore.setItemAsync(MODE_KEY, next);
        } catch {
            /* preference is best-effort */
        }
    }, []);

    const scheme = mode === "system" ? systemScheme : mode;
    const colors = paletteFor(scheme);

    const value = useMemo(() => ({ mode, scheme, colors, setMode }), [mode, scheme, colors, setMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
