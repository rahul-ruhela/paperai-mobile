/**
 * Central UI barrel — import shared design system pieces from "../ui".
 */
export * from "./tokens";
export { Theme, useLegacyTheme, makeLegacyTheme } from "./theme";

export { ThemeProvider, useTheme, APPEARANCE_OPTIONS } from "./ThemeProvider";
export { default as useThemedStyles } from "./useThemedStyles";

export { default as AppIcon } from "./AppIcon";
export { default as ScreenContainer } from "./ScreenContainer";
export { default as GradientScreen } from "./GradientScreen";
export { default as GlassCard } from "./GlassCard";
export { default as Card } from "./Card";
export { default as AppInput } from "./AppInput";
export { default as StatusBadge } from "./StatusBadge";
export { default as GlassModal } from "./GlassModal";
export { default as AppButton } from "./AppButton";
export { default as AiHeader } from "./AiHeader";
export { default as AiOrb } from "./AiOrb";
export { default as ReminderCard } from "./ReminderCard";
export { default as SignaturePad, strokesToSvg } from "./SignaturePad";
export { default as useReduceMotion } from "./useReduceMotion";

export { PrimaryButton, SecondaryButton, DangerButton, PressScale } from "./buttons";
export { LoadingView, ErrorView, EmptyState } from "./states";
export { makeCommon, makeHomeStyles, makeTaskStyles } from "./styles";
