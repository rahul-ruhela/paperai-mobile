import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { getAccessToken } from "./src/storage/tokenStore";
import { ensureExpoGoTestCredits } from "./src/api/dev";
import ErrorBoundary from "./src/components/ErrorBoundary";

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
import TasksScreen from "./src/screens/TasksScreen";
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
import TermsScreen from "./src/screens/TermsScreen";
import HelpCenterScreen from "./src/screens/HelpCenterScreen";
import ContactSupportScreen from "./src/screens/ContactSupportScreen";
import JunkWiperScanScreen from "./src/screens/JunkWiperScanScreen";
import CameraDocumentScanScreen from "./src/screens/CameraDocumentScanScreen";
import CodeScannerScreen from "./src/screens/CodeScannerScreen";
import BootScreen from "./src/screens/BootScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/* =======================
   Tabs
======================= */
function Tabs({ onLoggedOut }) {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: "#2563EB",
                tabBarInactiveTintColor: "#6B7280",
                tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
                tabBarStyle: {
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderTopColor: "#E5E7EB",
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
                            ? "checkbox"
                            : "checkbox-outline",
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
            <Tab.Screen name="Tasks" component={TasksScreen} />
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
    // ✅ ALL hooks declared FIRST
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
                if (token) ensureExpoGoTestCredits();
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
    };

    // ✅ Conditional render AFTER hooks
    if (!ready) {
        return <BootScreen />;
    }

    return (
        <ErrorBoundary>
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: "#F5F7FB", // light app background
                    },
                    headerTitleAlign: "center",

                    headerTintColor: "#111111", // back arrow + title
                    headerTitleStyle: {
                        fontWeight: "700",
                        fontSize: 16,
                    },
                    headerShadowVisible: false, // removes bottom border
                    contentStyle: {
                        backgroundColor: "#F5F7FB", // PREVENTS dark flash
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
                                    onLoggedOut={() => setAuthed(false)}
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
                            name="CameraScanner"
                            component={CameraDocumentScanScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="CodeScanner"
                            component={CodeScannerScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
        </ErrorBoundary>
    );
}
