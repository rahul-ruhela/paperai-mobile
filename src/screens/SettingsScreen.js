import React, { useCallback, useEffect, useState } from "react";

import {
    View,
    Text,
    Alert,
    StyleSheet,
    Pressable,
    Switch,
    ActivityIndicator,
    ScrollView,
    Linking,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import { logout, deleteAccount } from "../api/auth";
import { fetchEntitlements, invalidateEntitlements } from "../services/entitlementService";
import { productInfoForSku } from "../constants/api";
import { getPushPreferences, updatePushPreferences, sendTestPush } from "../api/push";
import { isExpoGo } from "../api/dev";
import { registerForPushNotifications } from "../notifications/pushNotifications";

const DURATION_TITLE = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import { TEST_REMINDER_CHOICES, scheduleTestReminder } from "../services/reminderService";
import VoiceSettingsSection from "../ui/VoiceSettingsSection";
export default function SettingsScreen({ navigation, onLoggedOut }) {
    const { theme, preference, setPreference } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [entitlement, setEntitlement] = useState(null);
    const [loadingPlan, setLoadingPlan] = useState(true);

    // Push preferences. `null` while loading — the section renders a spinner
    // rather than briefly showing every switch in the wrong position.
    const [pushPrefs, setPushPrefs] = useState(null);
    const [pushError, setPushError] = useState(false);

    // Re-read on every focus, and force past the service's 30s cache: coming
    // back from the paywall after subscribing must show the new plan straight
    // away rather than a stale "Free".
    const refreshPlan = useCallback(async (force = false) => {
        if (force) invalidateEntitlements();
        try {
            const snap = await fetchEntitlements({ force });
            setEntitlement(snap);
        } finally {
            setLoadingPlan(false);
        }
    }, []);

    useEffect(() => {
        refreshPlan();
        const unsub = navigation.addListener("focus", () => refreshPlan(true));
        return unsub;
    }, [navigation, refreshPlan]);
    async function onLogout() {
        Alert.alert("Log out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log out",
                style: "destructive",
                onPress: async () => {
                    try {
                        await logout();
                        onLoggedOut?.(); // ✅ this flips authed=false in App.js
                    } catch (e) {
                        Alert.alert("Logout failed", e.message);
                    }
                },
            },
        ]);
    }

    function onDeleteAccount() {
        Alert.alert(
            "Delete account?",
            "This permanently deletes your account, documents, and personal data. Remaining credits are lost. Active subscriptions must be cancelled separately in App Store › Subscriptions.\n\nThis cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        // Second confirmation — deletion is irreversible.
                        Alert.alert(
                            "Are you absolutely sure?",
                            "Your account and data will be permanently deleted.",
                            [
                                { text: "Keep my account", style: "cancel" },
                                {
                                    text: "Delete permanently",
                                    style: "destructive",
                                    onPress: async () => {
                                        try {
                                            await deleteAccount();
                                            Alert.alert("Account deleted", "Your account and data have been removed.");
                                            onLoggedOut?.();
                                        } catch (e) {
                                            Alert.alert(
                                                "Deletion failed",
                                                e?.userMessage ?? e?.message ?? "Please try again or contact support."
                                            );
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    }

    useEffect(() => {
        let alive = true;
        getPushPreferences()
            .then((p) => alive && setPushPrefs(p))
            .catch(() => alive && setPushError(true));
        return () => {
            alive = false;
        };
    }, []);

    /**
     * Flips one switch optimistically and rolls back if the server refuses.
     * A toggle that springs back is honest; one that stays on while the server
     * still has it off would mean the user believes they opted out when they
     * have not.
     */
    async function togglePush(key, value) {
        const previous = pushPrefs;
        setPushPrefs((p) => ({ ...p, [key]: value }));
        try {
            const saved = await updatePushPreferences({ [key]: value });
            setPushPrefs(saved);
        } catch {
            setPushPrefs(previous);
            Alert.alert("Could Not Save", "That setting was not saved. Please check your connection and try again.");
        }
    }

    function PushToggle({ label, hint, prefKey }) {
        const value = !!pushPrefs?.[prefKey];
        return (
            <View style={styles.toggleRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle}>{label}</Text>
                    <Text style={styles.rowSub}>{hint}</Text>
                </View>
                <Switch
                    value={value}
                    onValueChange={(v) => togglePush(prefKey, v)}
                    trackColor={{ true: theme.colors.primary }}
                    accessibilityLabel={label}
                />
            </View>
        );
    }

    /**
     * Re-registers the device token and asks the server to push to this account.
     *
     * Shown only in a dev build or Expo Go — but the endpoint behind it is
     * admin-gated server-side, so it 403s for everyone else even if this UI ever
     * became visible. It exercises the whole chain in one tap: permission →
     * Expo token → backend → Expo relay → APNs → the notification handler.
     */

    // Schedules a real local notification a minute out. Nothing about it is
    // simulated: it is the same scheduling path a task alert uses, which is the
    // only way the preview is worth anything.
    async function sendTestReminder(minutes = 1) {
        const result = await scheduleTestReminder(minutes);

        if (result.ok) {
            const m = result.minutes ?? minutes;
            Alert.alert(
                "On its way",
                `Your test reminder arrives in about ${m} minute${m === 1 ? "" : "s"}. ` +
                    "Lock your phone to see how it looks on the lock screen."
            );
            return;
        }

        if (result.reason === "simulator") {
            Alert.alert(
                "Not available here",
                "Notifications only work on a real device, so there is nothing to show on a simulator."
            );
            return;
        }

        if (result.reason === "denied") {
            Alert.alert(
                "Notifications are off",
                "Paper AI cannot send reminders until notifications are turned on for it.",
                [
                    { text: "Not now", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]
            );
            return;
        }

        Alert.alert("Could not schedule", "The test reminder was not scheduled. Please try again.");
    }

    async function runTestPush() {
        const { token, reason, detail } = await registerForPushNotifications();

        if (!token) {
            // Each reason is a genuinely different problem with a different fix,
            // so each gets its own message rather than one vague catch-all.
            const explain = {
                simulator: [
                    "Needs A Real Device",
                    "The simulator has no connection to Apple's push service, so it cannot be given a push token. Run this on your iPhone.",
                ],
                "expo-go": [
                    "Not Available In Expo Go",
                    "Remote push notifications were removed from Expo Go in Expo SDK 53. Local reminders still work here, but a push token needs a development build or TestFlight.\n\nRun: eas build --profile development --platform ios",
                ],
                denied: [
                    "Notifications Are Off",
                    "Allow notifications for Paper AI Assistant in iOS Settings, then try again.",
                ],
                "no-project-id": [
                    "Missing Project ID",
                    "No EAS project id was found in app.json (extra.eas.projectId). Expo cannot issue a token without it.",
                ],
                "token-failed": [
                    "Could Not Get A Token",
                    `Expo refused to issue a push token.${detail ? `\n\n${detail}` : ""}`,
                ],
            }[reason] ?? ["Could Not Register", detail || "Unknown problem."];

            Alert.alert(explain[0], explain[1]);
            return;
        }

        if (reason === "server-failed") {
            // The device gave us a token; the backend would not take it. Almost
            // always means the push endpoints are not deployed yet.
            Alert.alert(
                "Server Did Not Accept The Token",
                `The device issued a push token but the API rejected it (${detail}).\n\n` +
                    "If this is a 404, the /api/push endpoints are not deployed yet."
            );
            return;
        }
        try {
            const res = await sendTestPush();
            Alert.alert(
                res?.ok ? "Test Sent" : "Not Sent",
                res?.ok
                    ? "It should arrive in a few seconds. Leave the app open to check the foreground banner, or background it to check the lock screen."
                    : `Expo rejected it: ${res?.error ?? "unknown"}`
            );
        } catch (e) {
            Alert.alert(
                "Test Failed",
                e?.response?.status === 403
                    ? "This account is not an admin, so the test endpoint is not available to it."
                    : e?.userMessage || "Could not reach the server."
            );
        }
    }

    function Row({ icon, title, subtitle, onPress, danger }) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
                <View style={[styles.rowIcon, danger && { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.dangerBorder }]}>
                    <Ionicons
                        name={icon}
                        size={18}
                        color={danger ? theme.colors.dangerText : theme.colors.accentText}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, danger && { color: theme.colors.dangerText }]}>{title}</Text>
                    {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
        );
    }

    function AppearanceOption({ value, label, icon, hint }) {
        const selected = preference === value;
        return (
            <Pressable
                onPress={() => setPreference(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label}. ${hint}`}
                style={({ pressed }) => [
                    styles.appearanceOption,
                    selected && styles.appearanceOptionActive,
                    pressed && { opacity: 0.8 },
                ]}
            >
                <Ionicons
                    name={icon}
                    size={20}
                    color={selected ? theme.colors.accentText : theme.colors.textMuted}
                />
                <Text style={[styles.appearanceLabel, selected && styles.appearanceLabelActive]}>
                    {label}
                </Text>
                {/* Selection is shown by a check as well as colour, so it does
                    not rely on colour alone. */}
                {selected ? (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.accentText} />
                ) : null}
            </Pressable>
        );
    }

    const isSubscribed = !!entitlement?.active;
    // Prefer the exact product's marketing name; fall back to the tier so a
    // plan the app doesn't recognise still reads sensibly.
    const skuInfo = entitlement?.productId ? productInfoForSku(entitlement.productId) : null;
    const planName = skuInfo
        ? `${skuInfo.tier.name} · ${DURATION_TITLE[skuInfo.duration] ?? skuInfo.duration}`
        : entitlement?.tier
        ? entitlement.tier.charAt(0).toUpperCase() + entitlement.tier.slice(1)
        : "Active plan";

    const renewalDate = entitlement?.expiresAtUtc ? new Date(entitlement.expiresAtUtc) : null;
    const renewalLine =
        renewalDate && !Number.isNaN(renewalDate.getTime())
            ? `Renews ${renewalDate.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
              })}`
            : null;

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={90}
                >
                    <ScrollView
                        contentContainerStyle={styles.container}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >

               {/* <View style={styles.container}>*/}
                    <Text style={styles.title}>Settings</Text>

                    <View style={styles.card}>
                        <Text style={styles.section}>Subscription</Text>
                        {loadingPlan ? (
                            <Text style={styles.planLoading}>Checking your plan…</Text>
                        ) : isSubscribed ? (
                            <>
                                <View style={styles.planRow}>
                                    <View style={styles.planBadge}>
                                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.successText} />
                                        <Text style={styles.planBadgeText}>ACTIVE</Text>
                                    </View>
                                    <Text style={styles.planName}>{planName}</Text>
                                </View>
                                {!!renewalLine && <Text style={styles.planMeta}>{renewalLine}</Text>}
                                <Text style={styles.planMeta}>
                                    {entitlement?.credits ?? 0} credits remaining
                                </Text>

                                <Row
                                    icon="swap-horizontal-outline"
                                    title="Change plan"
                                    subtitle="Upgrade, downgrade or switch billing period"
                                    onPress={() => navigation.navigate("Paywall")}
                                />
                                <Row
                                    icon="card-outline"
                                    title="Manage in App Store"
                                    subtitle="Cancel or change renewal — handled by Apple"
                                    onPress={() =>
                                        Linking.openURL("https://apps.apple.com/account/subscriptions")
                                    }
                                />
                            </>
                        ) : (
                            <>
                                <View style={styles.planRow}>
                                    <View style={[styles.planBadge, styles.planBadgeFree]}>
                                        <Text style={styles.planBadgeFreeText}>FREE</Text>
                                    </View>
                                    <Text style={styles.planName}>No active subscription</Text>
                                </View>
                                <Text style={styles.planMeta}>
                                    {entitlement?.credits ?? 0} credits remaining
                                </Text>
                                <Row
                                    icon="star-outline"
                                    title="See plans"
                                    subtitle="Subscribe to get credits every cycle"
                                    onPress={() => navigation.navigate("Paywall")}
                                />
                            </>
                        )}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Account</Text>

                        <Row
                            icon="person-outline"
                            title="Profile"
                            subtitle="Update name, email, phone"
                            onPress={() => navigation.navigate("Profile")}
                        />

                        <Row
                            icon="bar-chart-outline"
                            title="Credit Analytics"
                            subtitle="View usage insights"
                            onPress={() => navigation.navigate("Analytics")}
                        />

                        <Row
                            icon="star-outline"
                            title="Upgrade to AI Pro"
                            subtitle="More credits for AI features"
                            onPress={() => navigation.navigate("Paywall")}
                        />

                        <Row
                            icon="sparkles-outline"
                            title="Smart Recall"
                            subtitle="What Paper AI remembers from your notes"
                            onPress={() => navigation.navigate("Memories")}
                        />

                        <Row
                            icon="shield-checkmark-outline"
                            title="Privacy & Security"
                            subtitle="Vault, privacy score and what stays on this device"
                            onPress={() => navigation.navigate("PrivacyCenter")}
                        />

                        <Row
                            icon="hardware-chip-outline"
                            title="Storage Studio"
                            subtitle="Free up space on this device"
                            onPress={() => navigation.navigate("StorageStudio")}
                        />

                        <Row
                            icon="lock-open-outline"
                            title="App Permissions"
                            subtitle="See what Paper AI can access on this device"
                            onPress={() => navigation.navigate("PermissionCenter")}
                        />

                        <Row
                            icon="shield-checkmark-outline"
                            title="Privacy Policy"
                            subtitle="How we handle your documents"
                            onPress={() => navigation.navigate("Privacy")}
                        />

                        <Row
                            icon="document-text-outline"
                            title="Terms of Use (EULA)"
                            subtitle="User agreement and subscription terms"
                            onPress={() => navigation.navigate("Terms")}
                        />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Appearance</Text>
                        <Text style={styles.sectionHint}>
                            Choose how PaperAI looks. “System” follows your{" "}
                            {Platform.OS === "ios" ? "iOS" : "device"} Display setting.
                        </Text>

                        <View style={styles.appearanceRow} accessibilityRole="radiogroup">
                            <AppearanceOption
                                value="system"
                                label="System"
                                icon="phone-portrait-outline"
                                hint="Follow the device appearance setting"
                            />
                            <AppearanceOption
                                value="light"
                                label="Light"
                                icon="sunny-outline"
                                hint="Always use the light theme"
                            />
                            <AppearanceOption
                                value="dark"
                                label="Dark"
                                icon="moon-outline"
                                hint="Always use the dark theme"
                            />
                        </View>
                    </View>

                    {/* firstName is fetched by the panel itself. It is optional
                        by design: composeSentence drops the greeting entirely
                        when no name is known, rather than saying "Hey ,". */}
                    <VoiceSettingsSection navigation={navigation} />

                    <View style={styles.card}>
                        <Text style={styles.section}>Notifications</Text>
                        <Text style={styles.sectionHint}>
                            Turn these off any time. You can also disable all notifications for
                            Paper AI Assistant in {Platform.OS === "ios" ? "iOS" : "device"} Settings.
                        </Text>

                        {pushError ? (
                            <Text style={styles.rowSub}>
                                Notification settings are unavailable right now.
                            </Text>
                        ) : pushPrefs === null ? (
                            <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
                        ) : (
                            <>
                                <PushToggle
                                    prefKey="analysisComplete"
                                    label="Document ready"
                                    hint="When AI analysis of a document finishes."
                                />
                                <PushToggle
                                    prefKey="usageReminders"
                                    label="Unused credits"
                                    hint="An occasional nudge when credits are going unused."
                                />
                                <PushToggle
                                    prefKey="renewalReminders"
                                    label="Subscription renewal"
                                    hint="A few days before your plan renews."
                                />
                                {/* Kept visually and functionally separate from the
                                    three above. Guideline 4.5.4 requires explicit,
                                    revocable opt-in for anything promotional —
                                    accepting the OS prompt is not consent to
                                    marketing. Defaults to off, server-side. */}
                                <View style={styles.toggleDivider} />
                                <PushToggle
                                    prefKey="announcements"
                                    label="Offers and announcements"
                                    hint="New features, deals and product news. Off unless you turn it on."
                                />
                            </>
                        )}

                        {/* Visible to everyone, on purpose. A reminder is the
                            one part of the app you cannot judge without waiting
                            for a real due date to arrive, and anything unlocked
                            by a secret account or gesture would be a guideline
                            2.3.1 hidden feature for no product gain. */}
                        <View style={styles.toggleDivider} />
                        <Row
                            icon="alarm-outline"
                            title="Send me a test reminder"
                            subtitle="See what a reminder looks like, on the lock screen"
                            onPress={() => sendTestReminder(1)}
                        />
                        {/* One minute is the default and stays the row's own
                            action; the longer delays are for checking that a
                            reminder still arrives after you have put the phone
                            down and left the app. */}
                        <View style={styles.delayRow}>
                            {TEST_REMINDER_CHOICES.map((m) => (
                                <Pressable
                                    key={m}
                                    onPress={() => sendTestReminder(m)}
                                    style={styles.delayChip}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Send a test reminder in ${m} minute${m === 1 ? "" : "s"}`}
                                >
                                    <Text style={styles.delayChipText}>{m} min</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Dev/Expo Go only. The endpoint is admin-gated on the
                            server regardless, so this cannot be used by a normal
                            account even if the row were visible. */}
                        {(__DEV__ || isExpoGo()) && (
                            <>
                                <View style={styles.toggleDivider} />
                                <Row
                                    icon="paper-plane-outline"
                                    title="Send test notification"
                                    subtitle="Dev build only · admin accounts only"
                                    onPress={runTestPush}
                                />
                            </>
                        )}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Support</Text>

                        <Row
                            icon="help-circle-outline"
                            title="Help Center"
                            subtitle="FAQs and troubleshooting"
                            onPress={() => navigation.navigate("HelpCenter")}
                        />

                        <Row
                            icon="mail-outline"
                            title="Contact Support"
                            subtitle="Email us for help"
                            onPress={() => navigation.navigate("ContactSupport")}
                        />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Session</Text>

                        <Row
                            icon="log-out-outline"
                            title="Log out"
                            subtitle="You’ll return to login"
                            onPress={onLogout}
                            danger
                        />

                        <Row
                            icon="trash-outline"
                            title="Delete Account"
                            subtitle="Permanently delete your account and data"
                            onPress={onDeleteAccount}
                            danger
                        />
                    </View>

                    <Text style={styles.footer}>
                        PaperAI • v1.0
                    </Text>

                 
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({

    container: {
        padding: 18,
        paddingBottom: 60, // ✅ ensures logout is visible
        gap: 16,
    },
    title: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },

    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 20,
        padding: 14,
        gap: 6,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    section: { color: t.colors.textMuted, fontSize: 15, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
    sectionHint: {
        color: t.colors.textMuted,
        fontSize: 12,
        fontWeight: "500",
        lineHeight: 17,
        marginBottom: 10,
    },

    planLoading: { color: t.colors.textMuted, fontWeight: "600", fontSize: 13, paddingVertical: 6 },
    planRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    planBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        backgroundColor: t.colors.successBg,
        borderColor: t.colors.successBorder,
    },
    planBadgeText: { color: t.colors.successText, fontWeight: "800", fontSize: 10 },
    planBadgeFree: { backgroundColor: t.colors.glassSoft, borderColor: t.colors.border },
    planBadgeFreeText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 10 },
    planName: { flex: 1, color: t.colors.textPrimary, fontWeight: "800", fontSize: 15 },
    planMeta: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12, marginBottom: 2 },

    appearanceRow: { flexDirection: "row", gap: 8 },
    appearanceOption: {
        flex: 1,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.glassSoft,
    },
    appearanceOptionActive: {
        borderColor: t.colors.primary,
        backgroundColor: t.colors.infoBg,
    },
    appearanceLabel: {
        color: t.colors.textSecondary,
        fontSize: 12,
        fontWeight: "700",
    },
    appearanceLabelActive: { color: t.colors.accentText },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        minHeight: 44,
        borderRadius: 16,
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        minHeight: 48,
    },
    // Separates the promotional opt-in from the transactional switches above it,
    // so the two are not read as one undifferentiated group.
    toggleDivider: {
        height: 1,
        backgroundColor: t.colors.separator,
        marginVertical: 8,
    },
    rowIcon: {
        width: 38,
        height: 38,
        borderRadius: 14,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1,
        borderColor: t.colors.infoBorder,
        alignItems: "center",
        justifyContent: "center",
    },
    rowTitle: { color: t.colors.textPrimary, fontWeight: "700" },
    rowSub: { marginTop: 2, color: t.colors.textMuted, fontWeight: "500", fontSize: 12 },

    footer: { marginTop: "auto", textAlign: "center", color: t.colors.textMuted, fontWeight: "600" },
});
