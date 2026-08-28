/**
 * ThemeProvider — owns the active appearance for the whole app.
 *
 * The user picks one of three preferences in Settings › Appearance:
 *   "system" (default) — follow the iOS/Android appearance setting, live
 *   "light"            — always the 2026 light redesign
 *   "dark"             — always the original dark palette
 *
 * The preference is persisted so it survives relaunch. `useColorScheme()` is
 * only consulted when the preference is "system", which is what lets the OS
 * toggle (or the sunset auto-switch) flow through without a restart.
 *
 * NOTE: for `useColorScheme()` to ever report "dark", app.json must set
 * `userInterfaceStyle: "automatic"`. With "light" the OS hands every RN app a
 * permanently light scheme and the System option would silently do nothing.
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

import { getTheme } from "./tokens";

const STORAGE_KEY = "appearancePreference";

export const APPEARANCE_OPTIONS = ["system", "light", "dark"];

const ThemeContext = createContext(null);

function normalizePreference(value) {
    return APPEARANCE_OPTIONS.includes(value) ? value : "system";
}

export function ThemeProvider({ children }) {
    const systemScheme = useColorScheme();
    const [preference, setPreferenceState] = useState("system");
    const [hydrated, setHydrated] = useState(false);

    // Guards against a late-resolving read clobbering a choice the user made
    // while the read was still in flight.
    const userTouched = useRef(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const stored = await SecureStore.getItemAsync(STORAGE_KEY);
                if (mounted && stored && !userTouched.current) {
                    setPreferenceState(normalizePreference(stored));
                }
            } catch {
                // Keychain unavailable — fall back to following the system.
            } finally {
                if (mounted) setHydrated(true);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    const setPreference = useCallback((next) => {
        const value = normalizePreference(next);
        userTouched.current = true;
        setPreferenceState(value);
        // Fire-and-forget: a failed write only costs the preference at next
        // launch, and blocking the UI on the keychain would feel laggy.
        SecureStore.setItemAsync(STORAGE_KEY, value).catch(() => {});
    }, []);

    // `useColorScheme()` returns null briefly on some cold starts; treat that
    // as light rather than flashing dark.
    const resolvedScheme =
        preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

    const theme = getTheme(resolvedScheme);

    const value = useMemo(
        () => ({
            theme,
            colors: theme.colors,
            scheme: resolvedScheme,
            isDark: theme.isDark,
            preference,
            setPreference,
            hydrated,
        }),
        [theme, resolvedScheme, preference, setPreference, hydrated]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme() must be used inside <ThemeProvider>");
    }
    return ctx;
}

/**
 * Escape hatch for the few modules that run outside the React tree (e.g. a
 * StyleSheet built at module scope). Prefer useTheme() everywhere else.
 */
export { getTheme };
