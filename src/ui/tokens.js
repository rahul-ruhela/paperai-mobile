/**
 * Centralized design tokens for PaperAI.
 *
 * This is the single source of truth for colors, gradients, spacing, radius,
 * shadow and motion.
 *
 * The app ships two appearances:
 *   - "light" — the 2026 redesign (soft blue-grey glass on white)
 *   - "dark"  — the original near-black palette, kept as a first-class theme
 *
 * Both palettes expose the *same key set*, so a component written against
 * `theme.colors.x` renders correctly in either appearance. Nothing here reads
 * the active scheme; the scheme is chosen by ThemeProvider and handed down
 * through context. See ./ThemeProvider and ./useThemedStyles.
 *
 * Components should NOT import `AppColors` directly any more — that export is
 * a frozen light-only snapshot kept for backwards compatibility while screens
 * migrate. Use `useTheme()` / `useThemedStyles()` instead.
 */
import { Platform } from "react-native";

/* =======================
   Palettes
======================= */

const lightColors = {
    primary: "#4F8CFF",
    primaryLight: "#6EA8FF",
    primaryDark: "#2563EB",
    // Text/icon color that sits ON TOP of a primary-filled surface.
    onPrimary: "#FFFFFF",

    accent: "#FFD54A",
    accentLight: "#FFEA9A",
    onAccent: "#111111",

    danger: "#FF5A5F",
    dangerLight: "#FF8A8E",
    // Used for error *text*, so it must stay readable on the page background.
    dangerDark: "#DC2626",

    background: "#F5F7FB",
    surface: "#FFFFFF",
    // Raised surface for cards sitting on top of `surface`.
    surfaceAlt: "#EEF2FB",
    glass: "rgba(255,255,255,0.74)",
    // Lighter-weight glass for chips, search fields and inline rows.
    glassSoft: "rgba(255,255,255,0.60)",
    glassBorder: "rgba(255,255,255,0.90)",

    textPrimary: "#111111",
    textSecondary: "#374151",
    textMuted: "#6B7280",
    link: "#2563EB",

    // "Coloured text" roles. These must invert between appearances: a shade
    // dark enough to read on white is invisible on near-black, so each has a
    // dark-mode counterpart at the light end of the same hue.
    accentText: "#2563EB",
    warningText: "#B45309",
    successText: "#15803D",
    dangerText: "#DC2626",
    // Translucent fill for secondary/ghost buttons.
    glassButton: "rgba(255,255,255,0.72)",

    border: "#E5E7EB",
    inputBg: "rgba(255,255,255,0.82)",
    inputBorder: "#D1D5DB",
    placeholder: "#9CA3AF",
    disabled: "#D1D5DB",
    disabledText: "#6B7280",

    // status
    success: "#22C55E",
    warning: "#F59E0B",
    info: "#3B82F6",

    // soft tinted fills for badges / banners
    successBg: "rgba(34,197,94,0.12)",
    warningBg: "rgba(245,158,11,0.12)",
    dangerBg: "rgba(255,90,95,0.12)",
    infoBg: "rgba(79,140,255,0.12)",

    // Matching hairlines for the tinted fills above.
    successBorder: "rgba(34,197,94,0.35)",
    warningBorder: "rgba(245,158,11,0.40)",
    dangerBorder: "rgba(255,90,95,0.35)",
    infoBorder: "rgba(79,140,255,0.30)",
    accentBg: "rgba(255,213,74,0.20)",
    // Barely-there fill for ghost/pressed affordances.
    ghostFill: "rgba(0,0,0,0.04)",

    // chrome
    tabBar: "rgba(255,255,255,0.96)",
    headerBg: "#F5F7FB",
    separator: "#E5E7EB",
    // Scrim behind modals / action sheets.
    overlay: "rgba(17,17,17,0.45)",
    sheet: "#FFFFFF",
    skeleton: "#E5E7EB",
    shadowColor: "#111111",

    white: "#FFFFFF",
    black: "#111111",

    // ── Scanning radar ──────────────────────────────────────────────────────
    // The radar was built against a dark navy panel and hardcoded its whole
    // palette, so in light mode the panel, its text and its accents were all
    // wrong together. Both schemes are defined here so a change to one is a
    // visible omission in the other.
    radarText: "#0F1B3D",
    // 4.79:1 on the light radar gradient. #5B6B8C measured 4.29, which is
    // under WCAG AA for the 12px body text this drives.
    radarMuted: "#55647F",
    radarAccent: "#0369A1",
    radarWarn: "#B91C1C",
    radarDivider: "rgba(15,27,61,0.18)",
    // Base RGB for every radar ring, chip and fill, so one token drives
    // all their alpha variants instead of thirteen literals per scheme.
    radarTintRgb: "3,105,161",
    // Light mode is deliberately a DIFFERENT design, not the dark radar
    // recoloured: an opaque card with a crisp border and flat rings, rather
    // than a glow bloomed over a near-black panel. Glow needs darkness to read
    // as glow; on white it just looks like a smudge.
    radarSurface: "#FFFFFF",
    radarBorder: "rgba(15,27,61,0.14)",
    radarRingWidth: 2,
    radarGlowOpacity: 0,
    radarSweepFrom: "rgba(3,105,161,0)",
    radarSweepTo: "rgba(3,105,161,0.42)",
};

const darkColors = {
    // Lifted from the blue end of the ramp so it keeps ~4.5:1 on the dark bg.
    primary: "#6EA8FF",
    primaryLight: "#9CC4FF",
    primaryDark: "#4F8CFF",
    onPrimary: "#06122B",

    accent: "#FFD54A",
    accentLight: "#FFE79A",
    onAccent: "#111111",

    danger: "#FF6B70",
    dangerLight: "#FF9599",
    // Inverted vs light on purpose: error text must be LIGHT on a dark page.
    dangerDark: "#FF8A8E",

    background: "#050816",
    surface: "#0B1228",
    surfaceAlt: "#111A33",
    glass: "rgba(255,255,255,0.07)",
    glassSoft: "rgba(255,255,255,0.05)",
    glassBorder: "rgba(255,255,255,0.14)",

    textPrimary: "#EAF0FF",
    textSecondary: "rgba(234,240,255,0.80)",
    textMuted: "rgba(234,240,255,0.56)",
    link: "#8AB8FF",

    accentText: "#8AB8FF",
    warningText: "#FBBF24",
    successText: "#34D399",
    dangerText: "#FF8A8E",
    glassButton: "rgba(255,255,255,0.06)",

    border: "rgba(255,255,255,0.12)",
    inputBg: "rgba(255,255,255,0.06)",
    inputBorder: "rgba(255,255,255,0.18)",
    placeholder: "rgba(234,240,255,0.42)",
    disabled: "rgba(255,255,255,0.12)",
    disabledText: "rgba(234,240,255,0.40)",

    success: "#34D399",
    warning: "#FBBF24",
    info: "#6EA8FF",

    successBg: "rgba(52,211,153,0.16)",
    warningBg: "rgba(251,191,36,0.16)",
    dangerBg: "rgba(255,107,112,0.16)",
    infoBg: "rgba(110,168,255,0.16)",

    successBorder: "rgba(52,211,153,0.40)",
    warningBorder: "rgba(251,191,36,0.40)",
    dangerBorder: "rgba(255,107,112,0.40)",
    infoBorder: "rgba(110,168,255,0.40)",
    accentBg: "rgba(255,213,74,0.16)",
    ghostFill: "rgba(255,255,255,0.06)",

    tabBar: "rgba(11,18,40,0.98)",
    headerBg: "#050816",
    separator: "rgba(255,255,255,0.12)",
    overlay: "rgba(0,0,0,0.62)",
    sheet: "#0B1228",
    skeleton: "rgba(255,255,255,0.10)",
    shadowColor: "#000000",

    white: "#FFFFFF",
    black: "#111111",

    // See the note in the light palette — both schemes live together.
    radarText: "#FFFFFF",
    radarMuted: "#94A3B8",
    radarAccent: "#7DD3FC",
    radarWarn: "#FCA5A5",
    radarDivider: "rgba(148,163,184,0.25)",
    radarTintRgb: "56,189,248",
    radarSurface: "transparent",
    radarBorder: "transparent",
    radarRingWidth: 1,
    radarGlowOpacity: 1,
    radarSweepFrom: "rgba(56,189,248,0)",
    radarSweepTo: "rgba(56,189,248,0.55)",
};

const lightGradients = {
    primary: ["#4F8CFF", "#6EA8FF"],
    accent: ["#FFD54A", "#FFEA9A"],
    danger: ["#FF5A5F", "#FF8A8E"],
    background: ["#F5F7FB", "#EEF2FB", "#F5F7FB"],
    // The scanning radar. It used to hardcode the dark navy ramp in both
    // appearances, so a light-mode scan dropped a near-black panel into an
    // otherwise pale screen. Defined per scheme here so there is one place
    // to change it and no way to forget the other mode.
    radar: ["#E8EEFB", "#DCE7FA", "#EAF0FC"],
};

const darkGradients = {
    primary: ["#4F8CFF", "#6EA8FF"],
    accent: ["#FFD54A", "#FFE79A"],
    danger: ["#FF5A5F", "#FF8A8E"],
    background: ["#050816", "#070B1E", "#0B1228"],
    radar: ["#0A1230", "#0B1B44", "#08122E"],
};

/* =======================
   Scheme-independent scales
======================= */
export const Spacing = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
};

export const Radius = {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 20,
    pill: 999,
};

export const Motion = {
    fast: 140,
    base: 220,
    slow: 320,
    pressScale: 0.97,
};

export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;

/* =======================
   Derived, per-scheme pieces
======================= */

// Shadows tint themselves with the palette, and dark mode needs a heavier,
// pure-black shadow because a coloured glow reads as haze on a near-black bg.
function makeShadows(colors, isDark) {
    if (Platform.OS === "android") {
        return { glass: { elevation: 4 }, button: { elevation: 3 }, soft: { elevation: 2 } };
    }
    return {
        glass: {
            shadowColor: isDark ? colors.shadowColor : colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.45 : 0.1,
            shadowRadius: 18,
        },
        button: {
            shadowColor: isDark ? colors.shadowColor : colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.5 : 0.24,
            shadowRadius: 12,
        },
        soft: {
            shadowColor: colors.shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.4 : 0.06,
            shadowRadius: 10,
        },
    };
}

function makeTypography(colors) {
    return {
        h1: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
        h2: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
        h3: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
        body: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
        caption: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
        link: { fontSize: 14, fontWeight: "600", color: colors.link },
        error: { fontSize: 13, fontWeight: "600", color: colors.dangerDark },
    };
}

function buildTheme(scheme) {
    const isDark = scheme === "dark";
    const colors = isDark ? darkColors : lightColors;
    const shadows = makeShadows(colors, isDark);

    return {
        scheme,
        isDark,
        colors,
        gradients: isDark ? darkGradients : lightGradients,
        shadows,
        typography: makeTypography(colors),
        spacing: Spacing,
        radius: Radius,
        motion: Motion,

        // Style presets
        glassCard: {
            backgroundColor: colors.glass,
            borderColor: colors.glassBorder,
            borderWidth: 1,
            borderRadius: Radius.xl,
            ...shadows.glass,
        },
        input: {
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            borderWidth: 1,
            borderRadius: Radius.md,
            color: colors.textPrimary,
            minHeight: 52,
            paddingHorizontal: 16,
            fontSize: 15,
        },

        // Bottom scrim that dissolves scrolled content into the page
        // background — must resolve to the *same* colour as `background`.
        fade: isDark
            ? ["rgba(5,8,22,0)", "rgba(5,8,22,0.65)", "rgba(5,8,22,1)"]
            : ["rgba(245,247,251,0)", "rgba(245,247,251,0.65)", "rgba(245,247,251,1)"],

        // React Navigation / StatusBar helpers
        statusBarStyle: isDark ? "light" : "dark",
        // iOS keyboard appearance for TextInputs.
        keyboardAppearance: isDark ? "dark" : "light",
    };
}

// Themes are immutable, so build each once and hand out the same object.
// This keeps `useThemedStyles` memoization keyed on a stable reference.
const THEMES = {
    light: buildTheme("light"),
    dark: buildTheme("dark"),
};

export function getTheme(scheme) {
    return THEMES[scheme === "dark" ? "dark" : "light"];
}

export const Themes = THEMES;

/* =======================
   Legacy exports (light-only)
======================= */
/** @deprecated Use `useTheme().colors` — this snapshot never turns dark. */
export const AppColors = lightColors;
/** @deprecated Use `useTheme().gradients`. */
export const AppGradients = lightGradients;
/** @deprecated Use `useTheme().shadows`. */
export const Shadows = THEMES.light.shadows;
/** @deprecated Use `useTheme().typography`. */
export const Typography = THEMES.light.typography;
/** @deprecated Use `useTheme().glassCard`. */
export const GlassCardStyle = THEMES.light.glassCard;
/** @deprecated Use `useTheme().input`. */
export const InputStyle = THEMES.light.input;
