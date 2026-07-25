/**
 * Legacy theme bridge.
 *
 * The app originally shipped a dark palette exposed through `Theme.colors`.
 * The design system now lives in ./tokens (AppColors / AppGradients / …).
 * To avoid rewriting every screen at once, this file keeps the same
 * `Theme` shape but maps each legacy key onto the new light tokens, so any
 * screen still reading `Theme.colors.text` etc. picks up the new branding.
 *
 * New code should import from "./tokens" directly.
 */
import { AppColors, Radius, Spacing } from "./tokens";

export const Theme = {
    colors: {
        // page backgrounds (were near-black) -> soft light shades
        bg0: "#F5F7FB",
        bg1: "#EEF2FB",
        bg2: "#F5F7FB",

        // surfaces (were translucent-white-on-dark) -> glass-on-light
        surface: AppColors.glass,
        surface2: "rgba(255,255,255,0.60)",
        border: AppColors.border,

        // text (was light-on-dark) -> dark-on-light
        text: AppColors.textPrimary,
        text2: AppColors.textSecondary,
        muted: AppColors.textMuted,

        primary: AppColors.primary,
        primary2: AppColors.primaryDark,

        danger: AppColors.danger,
        ok: AppColors.success,
        warn: AppColors.warning,
    },

    radius: { xl: Radius.xl, lg: Radius.lg, md: Radius.md, sm: Radius.sm },
    space: { s1: Spacing.xs, s2: Spacing.sm, s3: Spacing.md, s4: Spacing.lg },
};

export { AppColors, Radius, Spacing };
