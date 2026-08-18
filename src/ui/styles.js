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

        fab: {
            position: "absolute",
            right: 14,
            bottom: 92,
            zIndex: 50,
            elevation: 20,
            backgroundColor: t.colors.primary,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            ...shadowIOS(t),
        },
        fabText: { color: t.colors.white, fontWeight: "800", fontSize: 13 },
    });

export const makeTaskStyles = (t) =>
    StyleSheet.create({
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
