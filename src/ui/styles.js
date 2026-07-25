import { StyleSheet, Platform } from "react-native";
import { Theme } from "./theme";

export const Common = StyleSheet.create({
    flex1: { flex: 1 },
    screen: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
    row: { flexDirection: "row", alignItems: "center" },
    chip: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: Theme.colors.surface2,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    chipText: { color: Theme.colors.text2, fontWeight: "900", fontSize: 11 },

    shadowIOS:
        Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 10 },
            }
            : {},
});

export const HomeStyles = StyleSheet.create({
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: Theme.colors.surface2,
        borderRadius: Theme.radius.lg,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    searchInput: {
        flex: 1,
        color: Theme.colors.text,
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
        backgroundColor: Theme.colors.surface2,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    tabActive: {
        backgroundColor: "#4F8CFF",
        borderColor: "rgba(79,140,255,0.4)",
    },
    tabText: { color: Theme.colors.text2, fontWeight: "900", fontSize: 12 },
    tabTextActive: { color: "#FFFFFF" },

    card: {
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.radius.md,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        ...Common.shadowIOS,
    },

    thumb: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "rgba(79,140,255,0.10)",
        borderWidth: 1,
        borderColor: "rgba(79,140,255,0.18)",
        justifyContent: "center",
        alignItems: "center",
    },
    thumbImg: { width: 34, height: 34, borderRadius: 10 },

    title: { color: Theme.colors.text, fontWeight: "950", fontSize: 13 },
    preview: { color: Theme.colors.text2, fontWeight: "700", fontSize: 11, marginTop: 2 },
    previewMuted: { color: Theme.colors.muted, fontWeight: "700", fontSize: 11, marginTop: 2 },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    badge: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    badgeText: { fontSize: 10, fontWeight: "950" },

    conf: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    dot: { width: 7, height: 7, borderRadius: 999 },
    confText: { color: Theme.colors.text2, fontWeight: "900", fontSize: 10 },

    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.72)",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        justifyContent: "center",
        alignItems: "center",
    },

    highlight: { backgroundColor: "rgba(255,213,74,0.45)", borderRadius: 6 },

    emptyWrap: { marginTop: 44, alignItems: "center", paddingHorizontal: 22 },
    emptyIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: "rgba(79,140,255,0.10)",
        borderWidth: 1,
        borderColor: "rgba(79,140,255,0.18)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },
    emptyTitle: { color: Theme.colors.text, fontSize: 16, fontWeight: "950", textAlign: "center" },
    emptySub: { color: Theme.colors.text2, fontSize: 12, fontWeight: "750", textAlign: "center", marginTop: 6 },

    emptyBtn: {
        marginTop: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#4F8CFF",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
    },
    emptyBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.70)" },
    sheet: { backgroundColor: "#fff", padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    sheetTitle: { flex: 1, fontWeight: "800", fontSize: 15, color: "#111111" },
    sheetAction: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
    sheetText: { fontSize: 15, fontWeight: "700", color: "#111111" },

    aiPreview: {
        flexDirection: "row",
        gap: 10,
        backgroundColor: "rgba(79,140,255,0.10)",
        padding: 12,
        borderRadius: 14,
        marginTop: 12,
        marginBottom: 6,
    },
    aiText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#111111" },

    fab: {
        position: "absolute",
        right: 14,
        bottom: 92,
        zIndex: 50,
        elevation: 20,
        backgroundColor: "#4F8CFF",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        ...Common.shadowIOS,
    },
    fabText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});

export const TaskStyles = StyleSheet.create({
    addCard: {
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.radius.xl,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: 12,
        marginTop: 10,
        marginBottom: 12,
        ...Common.shadowIOS,
    },
    input: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
        color: Theme.colors.text,
        fontWeight: "800",
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: Theme.colors.surface2,
    },
    addRow: { flexDirection: "row", alignItems: "center", gap: 10 },

    taskCard: {
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.radius.lg,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: 12,
        marginBottom: 10,
        ...Common.shadowIOS,
    },
    taskTitle: { color: Theme.colors.text, fontWeight: "950", fontSize: 14, flex: 1 },
    metaRow: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center" },
    due: { color: Theme.colors.muted, fontWeight: "800" },
    why: { marginTop: 10, color: Theme.colors.primary2, fontWeight: "900" },
    explain: { marginTop: 6, color: Theme.colors.text2, fontWeight: "750", lineHeight: 18 },
});
