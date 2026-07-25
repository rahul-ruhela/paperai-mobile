/**
 * Centralized design tokens for PaperAI.
 *
 * This is the single source of truth for colors, gradients, spacing,
 * radius, shadow and motion. All reusable UI components and screens
 * should import from here instead of hardcoding values.
 */
import { Platform } from "react-native";

/* =======================
   Colors
======================= */
export const AppColors = {
    primary: "#4F8CFF",
    primaryLight: "#6EA8FF",
    primaryDark: "#2563EB",

    accent: "#FFD54A",
    accentLight: "#FFEA9A",

    danger: "#FF5A5F",
    dangerLight: "#FF8A8E",
    dangerDark: "#DC2626",

    background: "#F5F7FB",
    surface: "#FFFFFF",
    glass: "rgba(255,255,255,0.74)",
    glassBorder: "rgba(255,255,255,0.90)",

    textPrimary: "#111111",
    textSecondary: "#374151",
    textMuted: "#6B7280",
    link: "#2563EB",

    border: "#E5E7EB",
    inputBorder: "#D1D5DB",
    disabled: "#D1D5DB",
    disabledText: "#6B7280",

    // status
    success: "#22C55E",
    warning: "#F59E0B",

    white: "#FFFFFF",
    black: "#111111",
};

/* =======================
   Gradients
======================= */
export const AppGradients = {
    primary: ["#4F8CFF", "#6EA8FF"],
    accent: ["#FFD54A", "#FFEA9A"],
    danger: ["#FF5A5F", "#FF8A8E"],
    // soft page background
    background: ["#F5F7FB", "#EEF2FB", "#F5F7FB"],
};

/* =======================
   Spacing / Radius
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

/* =======================
   Shadows
======================= */
export const Shadows = {
    glass:
        Platform.OS === "android"
            ? { elevation: 4 }
            : {
                  shadowColor: AppColors.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.1,
                  shadowRadius: 18,
              },
    button:
        Platform.OS === "android"
            ? { elevation: 3 }
            : {
                  shadowColor: AppColors.primary,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.24,
                  shadowRadius: 12,
              },
    soft:
        Platform.OS === "android"
            ? { elevation: 2 }
            : {
                  shadowColor: "#111111",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 10,
              },
};

/* =======================
   Motion
======================= */
export const Motion = {
    fast: 140,
    base: 220,
    slow: 320,
    pressScale: 0.97,
};

/* =======================
   Typography scale
======================= */
export const Typography = {
    h1: { fontSize: 26, fontWeight: "800", color: AppColors.textPrimary },
    h2: { fontSize: 20, fontWeight: "700", color: AppColors.textPrimary },
    h3: { fontSize: 16, fontWeight: "700", color: AppColors.textPrimary },
    body: { fontSize: 14, fontWeight: "500", color: AppColors.textSecondary },
    caption: { fontSize: 12, fontWeight: "500", color: AppColors.textMuted },
    link: { fontSize: 14, fontWeight: "600", color: AppColors.link },
    error: { fontSize: 13, fontWeight: "600", color: AppColors.dangerDark },
};

/* =======================
   Style presets
======================= */
export const GlassCardStyle = {
    backgroundColor: AppColors.glass,
    borderColor: AppColors.glassBorder,
    borderWidth: 1,
    borderRadius: Radius.xl,
    ...Shadows.glass,
};

export const InputStyle = {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderColor: AppColors.inputBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: AppColors.textPrimary,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 15,
};

/* =======================
   Accessibility helpers
======================= */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;
