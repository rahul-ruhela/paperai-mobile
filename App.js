import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { getAccessToken } from "./src/storage/tokenStore";
import { ensureExpoGoTestCredits } from "./src/api/dev";
import {
    registerForPushNotifications,
    unregisterPushNotifications,
} from "./src/notifications/pushNotifications";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./src/ui/ThemeProvider";

/* =======================
   Auth Screens
======================= */
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import OtpLoginScreen from "./src/screens/OtpLoginScreen";
import EmailOtpVerifyScreen from "./src/screens/EmailOtpVerifyScreen";

/* =======================
   Main Screens
======================= */
import HomeScreen from "./src/screens/HomeScreen";
import UploadScreen from "./src/screens/UploadScreen";
import AssistantScreen from "./src/screens/AssistantScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ProcessScreen from "./src/screens/ProcessScreen";
import DocumentDetailScreen from "./src/screens/DocumentDetailScreen";
import AnalysisScreen from "./src/screens/AnalysisScreen";

/* =======================
   Optional
======================= */
import PaywallScreen from "./src/screens/PaywallScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CreditAnalyticsScreen from "./src/screens/CreditAnalyticsScreen";
import PrivacyScreen from "./src/screens/PrivacyScreen";
import PermissionCenterScreen from "./src/screens/PermissionCenterScreen";
import PrivacyCenterScreen from "./src/screens/PrivacyCenterScreen";
import VaultScreen from "./src/screens/VaultScreen";
import MemoriesScreen from "./src/screens/MemoriesScreen";
import TermsScreen from "./src/screens/TermsScreen";
import HelpCenterScreen from "./src/screens/HelpCenterScreen";
import ContactSupportScreen from "./src/screens/ContactSupportScreen";
import JunkWiperScanScreen from "./src/screens/JunkWiperScanScreen";
import StorageStudioScreen from "./src/screens/StorageStudioScreen";
import StorageScanScreen from "./src/screens/StorageScanScreen";
import CameraDocumentScanScreen from "./src/screens/CameraDocumentScanScreen";
import CodeScannerScreen from "./src/screens/CodeScannerScreen";
import SignatureScreen from "./src/screens/SignatureScreen";
import AiChatScreen from "./src/screens/AiChatScreen";
import ReceiptCaptureScreen from "./src/screens/ReceiptCaptureScreen";
import ExpensesScreen from "./src/screens/ExpensesScreen";
import BootScreen from "./src/screens/BootScreen";

// Shared ref so a tapped reminder notification can navigate from outside any
// screen. `isReady()` gates every use — a notification can be delivered before
// the navigator has mounted, and navigating then throws.
const navigationRef = createNavigationContainerRef();

// Without a handler, a notification that arrives while the app is in the
// FOREGROUND is delivered silently — no banner, no sound. That is exactly the
// case when someone schedules a reminder and stays in the app to watch for it,
// so the feature looks broken while working perfectly.
//
// One did exist in src/notifications/pushNotifications.js, but nothing ever
// imports that module, so it never ran. Registering at module scope here means
// it is in place before any notification can be delivered.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        // shouldShowBanner/shouldShowList are the SDK 54 names; shouldShowAlert
        // is the pre-53 spelling, kept so behaviour does not depend on which
        // one this version reads.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// A notification tapped while the app was terminated is delivered before the
// navigator exists. Park the target and flush it from NavigationContainer's
// onReady instead of dropping it — otherwise a cold launch from a reminder just
// opens the app on the Documents tab and the tap appears to have done nothing.
let pendingDeepLink = null;

function targetFromResponse(response) {
    const data = response?.notification?.request?.content?.data;
    if (!data) return null;

    const type = String(data.type ?? "");

    // Assistant task alerts carry no document — they open the Assistant tab.
    if (type === "task") return { screen: "Tasks" };

    // Two producers, two shapes:
    //   local Smart Reminders  → { type: "reminder", docId }
    //   server analysis-complete → { type: "ANALYSIS_COMPLETE", docId }
    // `documentId` is the older server spelling, kept so notifications already
    // sitting in someone's Notification Centre still deep-link correctly.
    const docId = data.docId ?? data.documentId;
    if (!docId) return null;

    const opensDocument =
        type === "reminder" || type === "ANALYSIS_COMPLETE" || data.screen === "Analysis";

    return opensDocument ? { screen: "Analysis", docId } : null;
}

function navigateTo(target) {
    if (!target) return;

    if (navigationRef.isReady()) {
        if (target.screen === "Tasks") {
            navigationRef.navigate("Main", { screen: "Tasks" });
        } else {
            navigationRef.navigate("Analysis", { docId: target.docId });
        }
    } else {
        pendingDeepLink = target;
    }
}

function flushDeepLink() {
    const target = pendingDeepLink;
    pendingDeepLink = null;
    if (target && navigationRef.isReady()) navigateTo(target);
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* =======================
   Tabs
======================= */
function Tabs({ onLoggedOut }) {
    const { colors } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: colors.accentText,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.separator,
                    height: 90,
                    paddingBottom: 12,
                    paddingTop: 4,
                },
                tabBarIcon: ({ focused, color, size }) => {
                    const icons = {
                        Documents: focused
                            ? "document-text"
                            : "document-text-outline",
                        Upload: focused
                            ? "cloud-upload"
                            : "cloud-upload-outline",
                        Tasks: focused
                            ? "sparkles"
                            : "sparkles-outline",
                        Settings: focused
                            ? "settings"
                            : "settings-outline",
                    };

                    return (
                        <Ionicons
                            name={icons[route.name]}
                            size={size}
                            color={color}
                        />
                    );
                },
            })}
        >
            <Tab.Screen name="Documents" component={HomeScreen} />
            <Tab.Screen name="Upload" component={UploadScreen} />
            {/* Route name stays "Tasks" so every existing navigate("Tasks")
                call site and any parked deep link keeps working; only the label
                the user reads changes. */}
            <Tab.Screen
                name="Tasks"
                component={AssistantScreen}
                options={{ title: "Assistant" }}
            />
            <Tab.Screen name="Settings">
                {(props) => (
                    <SettingsScreen
                        {...props}
                        onLoggedOut={onLoggedOut}
                    />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

/* =======================
   App Root
======================= */
export default function App() {
    return (
        <ThemeProvider>
            <AppShell />
        </ThemeProvider>
    );
}

function AppShell() {
    // ✅ ALL hooks declared FIRST
    const { theme, hydrated } = useTheme();
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const token = await getAccessToken();
                if (mounted) {
                    setAuthed(!!token);
                }
                // Expo Go only: give fresh tester accounts dummy credits.
                if (token) {
                    ensureExpoGoTestCredits();
                    // Re-register every launch: tokens rotate on reinstall and
                    // after long inactivity, and re-sending an unchanged one is
                    // a no-op server-side.
                    registerForPushNotifications();
                }
            } catch {
                if (mounted) {
                    setAuthed(false);
                }
            } finally {
                if (mounted) {
                    setReady(true);
                }
            }
        };

        init();
        return () => {
            mounted = false;
        };
    }, []);

    // Called by every auth screen on successful sign-in / registration.
    // In Expo Go this also tops up brand-new accounts with dummy test credits.
    const handleAuthed = () => {
        setAuthed(true);
        ensureExpoGoTestCredits();
        // Deliberately after sign-in, never at first launch: the OS permission
        // prompt can only be shown once, and asking before the user has any
        // reason to say yes is how it gets denied permanently.
        registerForPushNotifications();
    };

    // Smart Reminders: tapping a reminder notification opens the document it
    // belongs to. Two paths, because they cover different launch states —
    // the listener catches taps while the app is running or backgrounded, and
    // getLastNotificationResponseAsync catches the tap that cold-launched it.
    useEffect(() => {
        let alive = true;

        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            navigateTo(targetFromResponse(response));
        });

        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (alive) navigateTo(targetFromResponse(response));
            })
            .catch(() => {});

        return () => {
            alive = false;
            sub.remove();
        };
    }, []);

    // ✅ Conditional render AFTER hooks.
    // `hydrated` gates on the stored appearance preference so the first paint
    // is already in the right palette instead of flashing light then swapping.
    if (!ready || !hydrated) {
        return <BootScreen />;
    }

    // Hand the palette to React Navigation too, so the container background,
    // headers and card transitions match the app rather than staying white.
    const navTheme = {
        ...(theme.isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(theme.isDark ? DarkTheme : DefaultTheme).colors,
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.headerBg,
            text: theme.colors.textPrimary,
            border: theme.colors.separator,
        },
    };

    return (
        <ErrorBoundary>
        <NavigationContainer ref={navigationRef} theme={navTheme} onReady={flushDeepLink}>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: theme.colors.headerBg,
                    },
                    headerTitleAlign: "center",

                    headerTintColor: theme.colors.textPrimary, // back arrow + title
                    headerTitleStyle: {
                        fontWeight: "700",
                        fontSize: 16,
                    },
                    headerShadowVisible: false, // removes bottom border
                    contentStyle: {
                        // PREVENTS a light flash between screen transitions
                        backgroundColor: theme.colors.background,
                    },
                }}
            >
                {!authed ? (
                    <>
                        <Stack.Screen
                            name="Login"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <LoginScreen
                                    {...props}
                                    onAuthed={handleAuthed}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="Register"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <RegisterScreen
                                    {...props}
                                    onAuthed={handleAuthed}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="OtpLogin"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <OtpLoginScreen
                                    {...props}
                                    onAuthed={handleAuthed}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="EmailOtpVerify"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <EmailOtpVerifyScreen
                                    {...props}
                                    onAuthed={handleAuthed}
                                />
                            )}
                        </Stack.Screen>
                    </>
                ) : (
                    <>
                        <Stack.Screen
                            name="Main"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <Tabs
                                    {...props}
                                    onLoggedOut={() => {
                                        unregisterPushNotifications();
                                        setAuthed(false);
                                    }}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen name="Process" component={ProcessScreen} />
                        <Stack.Screen name="Document" component={DocumentDetailScreen} />
                        <Stack.Screen name="Analysis" component={AnalysisScreen} />
                        <Stack.Screen name="Paywall" component={PaywallScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                        <Stack.Screen name="Analytics" component={CreditAnalyticsScreen} />
                        <Stack.Screen name="Privacy" component={PrivacyScreen} />
                        {/* The privacy CONTROL panel, distinct from "Privacy"
                            above, which is the policy document. */}
                        <Stack.Screen
                            name="PrivacyCenter"
                            component={PrivacyCenterScreen}
                            options={{ title: "Privacy & Security" }}
                        />
                        <Stack.Screen
                            name="Vault"
                            component={VaultScreen}
                            options={{ title: "Private Vault" }}
                        />
                        <Stack.Screen
                            name="Memories"
                            component={MemoriesScreen}
                            options={{ title: "Smart Recall" }}
                        />
                        {/* Standalone for now; Module 5 embeds the same panel
                            as a section inside the Privacy centre. */}
                        <Stack.Screen
                            name="PermissionCenter"
                            component={PermissionCenterScreen}
                            options={{ title: "Permissions" }}
                        />
                        <Stack.Screen name="Terms" component={TermsScreen} />
                        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
                        <Stack.Screen
                            name="ContactSupport"
                            component={ContactSupportScreen}
                        />
                        <Stack.Screen
                            name="JunkWiper"
                            component={JunkWiperScanScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="StorageStudio"
                            component={StorageStudioScreen}
                            options={{ title: "Storage Studio" }}
                        />
                        {/* One screen, four modes — the mode comes in as a route
                            param and sets the title, so every cleaner layer
                            shares the same review and delete path. */}
                        <Stack.Screen
                            name="StorageScan"
                            component={StorageScanScreen}
                            options={{ title: "Storage" }}
                        />
                        <Stack.Screen
                            name="CameraScanner"
                            component={CameraDocumentScanScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="CodeScanner"
                            component={CodeScannerScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Signature"
                            component={SignatureScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AiChat"
                            component={AiChatScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="ReceiptCapture"
                            component={ReceiptCaptureScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Expenses"
                            component={ExpensesScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
        </ErrorBoundary>
    );
}
