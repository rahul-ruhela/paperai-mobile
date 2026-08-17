/**
 * useThemedStyles — build a StyleSheet from the active theme.
 *
 * Usage (the factory must live at module scope so its identity is stable):
 *
 *   const makeStyles = (t) =>
 *       StyleSheet.create({
 *           screen: { backgroundColor: t.colors.background },
 *           title: { color: t.colors.textPrimary },
 *       });
 *
 *   export default function Screen() {
 *       const styles = useThemedStyles(makeStyles);
 *       ...
 *   }
 *
 * Results are cached per (factory, scheme) across every component instance, so
 * mounting 20 rows does not run StyleSheet.create 20 times, and flipping the
 * appearance re-uses the sheet built the last time that scheme was active.
 */
import { useTheme } from "./ThemeProvider";

// factory -> { light: styles, dark: styles }
const cache = new WeakMap();

export default function useThemedStyles(factory) {
    const { theme } = useTheme();

    let perScheme = cache.get(factory);
    if (!perScheme) {
        perScheme = {};
        cache.set(factory, perScheme);
    }

    if (!perScheme[theme.scheme]) {
        perScheme[theme.scheme] = factory(theme);
    }

    return perScheme[theme.scheme];
}
