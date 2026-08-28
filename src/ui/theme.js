/**
 * Legacy theme bridge.
 *
 * The app originally shipped a dark palette exposed through `Theme.colors`.
 * The design system now lives in ./tokens, and the active appearance comes
 * from ./ThemeProvider. This module keeps the old `Theme` *shape* alive so
 * screens written against `Theme.colors.text` can be migrated one at a time.
 *
 * Use `useLegacyTheme()` (reactive, follows the user's appearance choice)
 * rather than the static `Theme` export, which is frozen to the light palette.
 *
 * New code should use `useTheme()` / `useThemedStyles()` directly.
 */
import { useTheme } from "./ThemeProvider";
import { getTheme, Radius, Spacing } from "./tokens";

export function makeLegacyTheme(t) {
    const c = t.colors;

    return {
        colors: {
            bg0: c.background,
            bg1: t.gradients.background[1],
            bg2: c.surfaceAlt,

            surface: c.glass,
            surface2: c.glassSoft,
            border: c.border,

            text: c.textPrimary,
            text2: c.textSecondary,
            muted: c.textMuted,

            primary: c.primary,
            // The old `primary2` was the *readable* variant used for icons and
            // emphasis text, so it has to flip direction between appearances.
            primary2: t.isDark ? c.primaryLight : c.primaryDark,

            danger: c.danger,
            ok: c.success,
            warn: c.warning,
        },

        radius: { xl: Radius.xl, lg: Radius.lg, md: Radius.md, sm: Radius.sm },
        space: { s1: Spacing.xs, s2: Spacing.sm, s3: Spacing.md, s4: Spacing.lg },
    };
}

const LEGACY = {
    light: makeLegacyTheme(getTheme("light")),
    dark: makeLegacyTheme(getTheme("dark")),
};

/** Reactive legacy theme — re-renders when the user changes appearance. */
export function useLegacyTheme() {
    const { scheme } = useTheme();
    return LEGACY[scheme];
}

/** @deprecated Frozen to light. Use `useLegacyTheme()` or `useTheme()`. */
export const Theme = LEGACY.light;

export { Radius, Spacing };
