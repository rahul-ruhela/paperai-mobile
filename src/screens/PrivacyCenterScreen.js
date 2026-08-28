import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import { computePrivacyScore, isStale, scoreBand } from "../services/privacyScore";
import { readFlags, dismissDetection, clearFlags } from "../services/sensitiveStore";
import { unsecuredSensitive } from "../services/sensitiveDetection";
import { canSecureVault, VAULT_CRYPTO_INFO } from "../services/vaultCrypto";
import { vaultExists } from "../services/vaultStore";
import { STATE, getAllStatuses } from "../services/permissionStatus";
import { listDocuments } from "../api/documents";

/**
 * PrivacyCenterScreen — Settings → Privacy & Security (Module 5, §5).
 *
 * A control panel, kept separate from PrivacyScreen, which is the privacy
 * *policy*. Merging a legal document with a set of switches would make both
 * harder to read and neither easy to trust.
 *
 * Every number on this screen is computed on the device from things it can
 * already see, and none of it is uploaded. The score is advisory — see
 * services/privacyScore.js for why the copy never says "at risk".
 *
 * One deliberate departure from the spec's sketch: the Vault card shows whether
 * a vault exists, NOT how many items are in it. A count is exactly the kind of
 * thing §7.2 says a locked vault must not leak, and it cannot be read without
 * the key anyway — the index is encrypted with everything else.
 */

export default function PrivacyCenterScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [state, setState] = useState(null);

    const load = useCallback(async () => {
        // Documents come from the API; everything else is local. A failed
        // documents call degrades to "no documents known" rather than an error
        // screen — the vault and permission facts are still worth showing.
        const [flags, permissions, hasVault, docs] = await Promise.all([
            readFlags(),
            getAllStatuses().catch(() => null),
            vaultExists(),
            listDocuments().catch(() => null),
        ]);

        const unsecured = unsecuredSensitive({
            detections: flags.detections,
            dismissed: flags.dismissed,
        });
        const sensitiveTotal = Object.values(flags.detections).filter(Boolean).length;

        const score = computePrivacyScore({
            sensitiveTotal,
            sensitiveInVault: Math.max(0, sensitiveTotal - unsecured.length),
            vaultConfigured: hasVault,
            biometryAvailable: canSecureVault(),
            permissions: permissions
                ? permissions.map((p) => ({
                      key: p.key,
                      granted: p.state === STATE.GRANTED || p.state === STATE.LIMITED,
                      usedByApp: p.usedByApp,
                  }))
                : null,
            totalDocuments: docs?.length ?? 0,
            staleDocuments: (docs ?? []).filter((d) => isStale(d.updatedAt ?? d.createdAt)).length,
            // iOS gives an app no way to read the lock screen preview setting,
            // so this stays unknown rather than being guessed at.
            lockScreenPreviewHidden: null,
        });

        setState({ score, unsecured, hasVault, sensitiveTotal });
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    async function dismiss(id) {
        await dismissDetection(id);
        load();
    }

    function goTo(action) {
        if (!action?.route || action.route === "PrivacyCenter") return;
        navigation.navigate(action.route);
    }

    if (!state) {
        return (
            <GradientScreen>
                <View style={styles.loading}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </GradientScreen>
        );
    }

    const band = scoreBand(state.score.score);

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.card}>
                        <Text style={styles.section}>Privacy score</Text>
                        <View style={styles.scoreRow}>
                            <Text style={styles.scoreValue}>{state.score.score}</Text>
                            <View style={styles.scoreText}>
                                <Text style={styles.scoreBand}>{band.label}</Text>
                                <Text style={styles.hint}>
                                    Worked out on this device from what Paper AI can see. Nothing
                                    about it is uploaded, and it is a rough guide rather than a
                                    verdict on how safe you are.
                                </Text>
                            </View>
                        </View>

                        {state.score.actions.length > 0 ? (
                            <View style={styles.actions}>
                                {state.score.actions.map((action) => (
                                    <Pressable
                                        key={action.componentKey}
                                        accessibilityRole="button"
                                        onPress={() => goTo(action)}
                                        style={({ pressed }) => [
                                            styles.action,
                                            pressed && { opacity: 0.8 },
                                        ]}
                                    >
                                        <Ionicons
                                            name="arrow-forward-circle-outline"
                                            size={17}
                                            color={theme.colors.accentText}
                                        />
                                        <Text style={styles.actionText}>{action.label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : null}

                        {state.score.components.map((c) => (
                            <View key={c.key} style={styles.component}>
                                <View style={styles.componentHead}>
                                    <Text style={styles.componentLabel}>{c.label}</Text>
                                    <Text style={styles.componentPoints}>
                                        {c.points}/{c.weight}
                                    </Text>
                                </View>
                                <Text style={styles.hint}>{c.detail}</Text>
                            </View>
                        ))}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open your Private Vault"
                        onPress={() => navigation.navigate("Vault")}
                        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                    >
                        <Text style={styles.section}>Private Vault</Text>
                        <View style={styles.vaultRow}>
                            <Ionicons
                                name={state.hasVault ? "lock-closed" : "shield-outline"}
                                size={22}
                                color={theme.colors.primary}
                            />
                            <View style={styles.vaultText}>
                                {/* Whether a vault exists, never how much is in
                                    it — a count is precisely what a locked vault
                                    must not leak. */}
                                <Text style={styles.vaultTitle}>
                                    {state.hasVault ? "Set up and locked" : "Not set up yet"}
                                </Text>
                                <Text style={styles.hint}>
                                    {VAULT_CRYPTO_INFO.cipher}, with the key held in the iOS
                                    Keychain on this device only. It never syncs and is not in any
                                    backup.
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                        </View>
                    </Pressable>

                    <View style={styles.card}>
                        <Text style={styles.section}>Documents that look sensitive</Text>
                        {state.unsecured.length === 0 ? (
                            <Text style={styles.hint}>
                                {state.sensitiveTotal === 0
                                    ? "Paper AI has not spotted anything sensitive in the documents it has read. Detection runs on this device as you use the app, and the result is never sent anywhere."
                                    : "Everything Paper AI flagged is either in your Vault or has been dismissed."}
                            </Text>
                        ) : (
                            state.unsecured.map((d) => (
                                <View key={d.id} style={styles.detection}>
                                    <View style={styles.detectionHead}>
                                        <Ionicons
                                            name="alert-circle-outline"
                                            size={17}
                                            color={theme.colors.warningText}
                                        />
                                        <Text style={styles.detectionTitle}>
                                            This looks like a {d.label}
                                        </Text>
                                    </View>
                                    <Text style={styles.hint}>
                                        Paper AI saw {d.signals.slice(0, 2).join(" and ")}. It may
                                        be wrong — nothing has been moved or hidden.
                                    </Text>
                                    <View style={styles.detectionActions}>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() => navigation.navigate("Vault")}
                                            style={styles.detectionBtn}
                                        >
                                            <Text style={styles.detectionBtnText}>Open Vault</Text>
                                        </Pressable>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() => dismiss(d.id)}
                                            style={styles.detectionBtn}
                                        >
                                            <Text style={styles.dismissText}>Not sensitive</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Review app permissions"
                        onPress={() => navigation.navigate("PermissionCenter")}
                        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                    >
                        <Text style={styles.section}>App permissions</Text>
                        <View style={styles.vaultRow}>
                            <Ionicons name="key-outline" size={20} color={theme.colors.primary} />
                            <Text style={[styles.vaultText, styles.hint]}>
                                See exactly what Paper AI can reach on this device, and what each
                                permission is used for.
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                        </View>
                    </Pressable>

                    <View style={styles.card}>
                        <Text style={styles.section}>What Paper AI keeps here</Text>
                        <Text style={styles.hint}>
                            Vault contents, the detection results above and this score all stay on
                            this device. None of them is uploaded, and none of them is in the
                            privacy label because none of them is collected.
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                                Alert.alert(
                                    "Clear detection results?",
                                    "Paper AI forgets which documents it flagged, and which ones you dismissed. Nothing in your Vault is touched.",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Clear",
                                            style: "destructive",
                                            onPress: async () => {
                                                await clearFlags();
                                                load();
                                            },
                                        },
                                    ]
                                )
                            }
                            style={styles.clear}
                        >
                            <Text style={styles.clearText}>Clear detection results</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => navigation.navigate("Privacy")}
                            style={styles.clear}
                        >
                            <Text style={styles.policyText}>Read the privacy policy</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1 },
        loading: { flex: 1, alignItems: "center", justifyContent: "center" },
        container: { padding: 18, paddingBottom: 60, gap: 16 },

        card: {
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            borderRadius: 20,
            padding: 14,
            gap: 8,
            shadowColor: t.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.1,
            shadowRadius: 18,
            elevation: 4,
        },
        section: {
            color: t.colors.textMuted,
            fontSize: 15,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.4,
        },
        hint: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },

        scoreRow: { flexDirection: "row", alignItems: "center", gap: 14 },
        scoreValue: { color: t.colors.textPrimary, fontSize: 40, fontWeight: "800" },
        scoreText: { flex: 1, gap: 4 },
        scoreBand: { color: t.colors.textPrimary, fontSize: 15, fontWeight: "800" },

        actions: { gap: 8, marginTop: 4 },
        action: {
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
            backgroundColor: t.colors.infoBg,
        },
        actionText: { flex: 1, color: t.colors.accentText, fontWeight: "700", fontSize: 13 },

        component: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.colors.border },
        componentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        componentLabel: { color: t.colors.textSecondary, fontWeight: "700", fontSize: 13 },
        componentPoints: { color: t.colors.textMuted, fontWeight: "700", fontSize: 12 },

        vaultRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        vaultText: { flex: 1, gap: 3 },
        vaultTitle: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 15 },

        detection: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.colors.border },
        detectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
        detectionTitle: { flex: 1, color: t.colors.textPrimary, fontWeight: "700", fontSize: 14 },
        detectionActions: { flexDirection: "row", gap: 8 },
        detectionBtn: { minHeight: 44, justifyContent: "center", paddingRight: 16 },
        detectionBtnText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },
        dismissText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 13 },

        clear: { minHeight: 44, justifyContent: "center" },
        clearText: { color: t.colors.danger, fontWeight: "700", fontSize: 13 },
        policyText: { color: t.colors.accentText, fontWeight: "700", fontSize: 13 },
    });
