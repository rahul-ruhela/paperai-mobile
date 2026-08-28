/**
 * Shared screen stylesheets.
 *
 * These are *factories*, not stylesheets: each takes the active theme and
 * returns a StyleSheet. Screens consume them through `useThemedStyles`, which
 * caches one sheet per (factory, scheme):
 *
 *     const s = useThemedStyles(makeHomeStyles);
 */
import { StyleSheet, Platform } from "react-native";

function shadowIOS(t) {
    return Platform.OS === "ios"
        ? {
              shadowColor: t.colors.shadowColor,
              shadowOpacity: t.isDark ? 0.5 : 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
          }
        : {};
}

export const makeCommon = (t) =>
    StyleSheet.create({
        flex1: { flex: 1 },
        screen: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
        row: { flexDirection: "row", alignItems: "center" },
        chip: {
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
        },
        chipText: { color: t.colors.textSecondary, fontWeight: "900", fontSize: 11 },
        shadowIOS: shadowIOS(t),
    });

export const makeHomeStyles = (t) =>
    StyleSheet.create({
        // ── Home hero (greeting, AI orb, quick actions, stat strip) ──────────
        headerWrap: { paddingTop: 4 },

        greetRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
        },
        greetHi: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 22 },
        greetSub: { color: t.colors.textMuted, fontWeight: "700", fontSize: 12.5, marginTop: 2 },

        creditPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        creditPillText: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 13 },

        orb: { alignSelf: "center", marginTop: 2, marginBottom: 12 },

        quickRow: { flexDirection: "row", gap: 10 },
        quickTile: {
            flex: 1,
            alignItems: "center",
            gap: 7,
            paddingVertical: 14,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        quickIcon: {
            width: 38,
            height: 38,
            borderRadius: 38,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.infoBg,
        },
        quickLabel: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 12 },

        statStrip: {
            flexDirection: "row",
            alignItems: "center",
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        statCell: { flex: 1, alignItems: "center", gap: 2 },
        statValue: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 17 },
        statLabel: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11 },
        statDivider: { width: 1, height: 26, backgroundColor: t.colors.separator },

        searchBox: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: t.colors.glassSoft,
            borderRadius: t.radius.lg,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 8,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        searchInput: {
            flex: 1,
            color: t.colors.textPrimary,
            fontSize: 13,
            fontWeight: "700",
            paddingVertical: 0,
        },

        tabsRow: {
            flexDirection: "row",
            gap: 8,
            marginTop: 10,
            marginBottom: 8,
        },
        tab: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: t.colors.glassSoft,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        tabActive: {
            backgroundColor: t.colors.primary,
            borderColor: t.isDark ? "rgba(110,168,255,0.45)" : "rgba(79,140,255,0.4)",
        },
        tabText: { color: t.colors.textSecondary, fontWeight: "900", fontSize: 12 },
        tabTextActive: { color: t.colors.white },

        card: {
            backgroundColor: t.colors.glass,
            borderRadius: t.radius.md,
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: t.colors.border,
            ...shadowIOS(t),
        },

        thumb: {
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.isDark ? "rgba(110,168,255,0.24)" : "rgba(79,140,255,0.18)",
            justifyContent: "center",
            alignItems: "center",
        },
        thumbImg: { width: 34, height: 34, borderRadius: 10 },

        title: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 13 },
        preview: { color: t.colors.textSecondary, fontWeight: "700", fontSize: 11, marginTop: 2 },
        previewMuted: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11, marginTop: 2 },

        metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
        badge: {
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        badgeText: { fontSize: 10, fontWeight: "900" },

        conf: {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        dot: { width: 7, height: 7, borderRadius: 999 },
        confText: { color: t.colors.textSecondary, fontWeight: "900", fontSize: 10 },

        iconBtn: {
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: t.isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
            borderWidth: 1,
            borderColor: t.colors.border,
            justifyContent: "center",
            alignItems: "center",
        },

        highlight: {
            backgroundColor: t.isDark ? "rgba(255,213,74,0.30)" : "rgba(255,213,74,0.45)",
            borderRadius: 6,
        },

        emptyWrap: { marginTop: 44, alignItems: "center", paddingHorizontal: 22 },
        emptyIcon: {
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.isDark ? "rgba(110,168,255,0.24)" : "rgba(79,140,255,0.18)",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 12,
        },
        emptyTitle: {
            color: t.colors.textPrimary,
            fontSize: 16,
            fontWeight: "900",
            textAlign: "center",
        },
        emptySub: {
            color: t.colors.textSecondary,
            fontSize: 12,
            fontWeight: "700",
            textAlign: "center",
            marginTop: 6,
        },

        emptyBtn: {
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: t.colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
        },
        emptyBtnText: { color: t.colors.white, fontWeight: "800", fontSize: 13 },

        overlay: { flex: 1, backgroundColor: t.colors.overlay },
        sheet: {
            backgroundColor: t.colors.sheet,
            padding: 18,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
        },
        sheetTop: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
        },
        sheetTitle: { flex: 1, fontWeight: "800", fontSize: 15, color: t.colors.textPrimary },
        sheetAction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
        sheetText: { fontSize: 15, fontWeight: "700", color: t.colors.textPrimary },

        aiPreview: {
            flexDirection: "row",
            gap: 10,
            backgroundColor: t.colors.infoBg,
            padding: 12,
            borderRadius: 14,
            marginTop: 12,
            marginBottom: 6,
        },
        aiText: { flex: 1, fontSize: 13, fontWeight: "600", color: t.colors.textPrimary },

        // Outer shell: position, fill and shadow. It is the animated element,
        // so the padding lives on `fabPressable` below — otherwise the touch
        // target would be the label alone rather than the whole pill.
        fab: {
            position: "absolute",
            right: 14,
            bottom: 92,
            zIndex: 50,
            elevation: 20,
            backgroundColor: t.colors.primary,
            borderRadius: 999,
            // An absolutely positioned child inherits the parent's
            // `alignItems: stretch`, which blows the pill out to the full screen
            // width — the label then centres across the screen instead of
            // sitting next to the icon. flex-start makes the width content-sized.
            alignSelf: "flex-start",
            // Row here as well as on `fabPressable`, so the pill still lays out
            // as icon-then-label if this style is ever applied to the touchable
            // directly. Without it the two stack and the label wraps onto its
            // own line, which is exactly how the button read before.
            flexDirection: "row",
            alignItems: "center",
            // Never wider than the screen on a large accessibility text size.
            maxWidth: "88%",
            ...shadowIOS(t),
        },
        fabPressable: {
            paddingHorizontal: 16,
            paddingVertical: 12,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 1,
            gap: 8,
        },
        // flexShrink so an over-long label ellipsises inside the pill instead of
        // pushing the icon out; numberOfLines={1} on the Text keeps it one line.
        fabText: { color: t.colors.white, fontWeight: "800", fontSize: 13, flexShrink: 1 },
    });

export const makeTaskStyles = (t) =>
    StyleSheet.create({
        // ── Smart Reminders block, shown above the task list ─────────────────
        remWrap: { marginBottom: 14 },
        remHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
        remHeadTitle: { flex: 1, color: t.colors.textPrimary, fontWeight: "900", fontSize: 14 },
        remToggle: { color: t.colors.accentText, fontWeight: "800", fontSize: 12 },
        remCard: { marginBottom: 8 },
        remRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        remMain: { flex: 1, minWidth: 0 },
        remTitle: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 13 },
        remMeta: { color: t.colors.textMuted, fontWeight: "600", fontSize: 11.5, marginTop: 2 },
        remEmpty: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12 },

        // ── Snooze sheet (Advance tier) ──────────────────────────────────────
        snoozeOverlay: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: "center", padding: 28 },
        snoozeSheet: { backgroundColor: t.colors.sheet, borderRadius: 20, padding: 18, gap: 8 },
        snoozeTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },
        snoozeSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12.5, marginBottom: 6 },
        snoozeOption: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 13,
            paddingHorizontal: 12,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.glassSoft,
        },
        snoozeOptionText: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },
        snoozeCancel: { paddingVertical: 12, alignItems: "center" },
        snoozeCancelText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13 },

        addCard: {
            backgroundColor: t.colors.glass,
            borderRadius: t.radius.xl,
            borderWidth: 1,
            borderColor: t.colors.border,
            padding: 12,
            marginTop: 10,
            marginBottom: 12,
            ...shadowIOS(t),
        },
        input: {
            flex: 1,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 12,
            color: t.colors.textPrimary,
            fontWeight: "800",
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        addRow: { flexDirection: "row", alignItems: "center", gap: 10 },

        taskCard: {
            backgroundColor: t.colors.glass,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            padding: 12,
            marginBottom: 10,
            ...shadowIOS(t),
        },
        taskTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 14, flex: 1 },
        metaRow: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center" },
        due: { color: t.colors.textMuted, fontWeight: "800" },
        why: {
            marginTop: 10,
            color: t.isDark ? t.colors.primaryLight : t.colors.primaryDark,
            fontWeight: "900",
        },
        explain: { marginTop: 6, color: t.colors.textSecondary, fontWeight: "700", lineHeight: 18 },
    });
