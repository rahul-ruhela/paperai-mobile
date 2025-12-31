import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import UploadScreen from "./src/screens/UploadScreen";
import TasksScreen from "./src/screens/TasksScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ProcessScreen from "./src/screens/ProcessScreen";
import DocumentDetailScreen from "./src/screens/DocumentDetailScreen";
import { getAccessToken } from "./src/storage/tokenStore";
import PaywallScreen from "./src/screens/PaywallScreen";

import ProfileScreen from "./src/screens/ProfileScreen";
import CreditAnalyticsScreen from "./src/screens/CreditAnalyticsScreen";
import IAPSetupScreen from "./src/screens/IAPSetupScreen";

import PrivacyScreen from "./src/screens/PrivacyScreen";
import TermsScreen from "./src/screens/TermsScreen";
import HelpCenterScreen from "./src/screens/HelpCenterScreen";
import ContactSupportScreen from "./src/screens/ContactSupportScreen";


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs({ onLoggedOut }) {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: "#A5B4FC",
                tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
                tabBarStyle: {
                    backgroundColor: "rgba(13,20,38,0.92)",
                    borderTopColor: "rgba(255,255,255,0.08)",
                    height: 90,                 // ✅ more space
                    paddingBottom: 12,          // ✅ label space
                    paddingTop: 4,
                    paddingLeft: 10
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 2,               // ✅ avoid clipping
                },
                tabBarItemStyle: {
                    paddingVertical: 4,         // ✅ prevent cut-off
                }, 
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 2
                  
                },
                tabBarIcon: ({ focused, color, size }) => {
                    let icon;
                    if (route.name === "Documents")
                        icon = focused ? "document-text" : "document-text-outline";
                    if (route.name === "Upload")
                        icon = focused ? "cloud-upload" : "cloud-upload-outline";
                    if (route.name === "Tasks")
                        icon = focused ? "checkbox" : "checkbox-outline";
                    if (route.name === "Settings")
                        icon = focused ? "settings" : "settings-outline";

                    return <Ionicons name={icon} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Documents" component={HomeScreen} />
            <Tab.Screen name="Upload" component={UploadScreen} />
            <Tab.Screen name="Tasks" component={TasksScreen} />
            <Tab.Screen name="Settings">
                {(props) => <SettingsScreen {...props} onLoggedOut={onLoggedOut} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

export default function App() {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        getAccessToken().then((t) => {
            setAuthed(!!t);
            setReady(true);
        });
    }, []);

    if (!ready) return null;

    return (
        <NavigationContainer>
            <Stack.Navigator>
                {!authed ? (
                    <>
                        <Stack.Screen name="Login" options={{ headerShown: false }}>
                            {(props) => (
                                <LoginScreen {...props} onAuthed={() => setAuthed(true)} />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="Register"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <RegisterScreen {...props} onAuthed={() => setAuthed(true)} />
                            )}
                        </Stack.Screen>
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Main" options={{ headerShown: false }}>
                            {(props) => (
                                <Tabs {...props} onLoggedOut={() => setAuthed(false)} />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="Process"
                            component={ProcessScreen}
                            options={{
                                title: "AI Analysis",
                                headerStyle: { backgroundColor: "#0B1220" },
                                headerTintColor: "#fff",
                                headerTitleStyle: { fontWeight: "800" },
                            }}
                        />

                        <Stack.Screen
                            name="Document"
                            component={DocumentDetailScreen}
                            options={{
                                title: "Result",
                                headerStyle: { backgroundColor: "#0B1220" },
                                headerTintColor: "#fff",
                                headerTitleStyle: { fontWeight: "800" },
                            }}
                        />

                        <Stack.Screen
                            name="Paywall"
                            component={PaywallScreen}
                            options={{
                                title: "Upgrade",
                                headerStyle: { backgroundColor: "#0B1220" },
                                headerTintColor: "#fff",
                                headerTitleStyle: { fontWeight: "800" },
                            }}
                            />

                            <Stack.Screen
                                name="Profile"
                                component={ProfileScreen}
                                options={{
                                    title: "Profile",
                                    headerStyle: { backgroundColor: "#0B1220" },
                                    headerTintColor: "#fff",
                                    headerTitleStyle: { fontWeight: "800" },
                                }}
                            />


                            <Stack.Screen
                                name="Analytics"
                                component={CreditAnalyticsScreen}
                                options={{
                                    title: "Credit Analytics",
                                    headerStyle: { backgroundColor: "#0B1220" },
                                    headerTintColor: "#fff",
                                    headerTitleStyle: { fontWeight: "800" },
                                }}
                            />
                            <Stack.Screen
                                name="IAPSetup"
                                component={IAPSetupScreen}
                                options={{
                                    title: "Apple IAP",
                                    headerStyle: { backgroundColor: "#0B1220" },
                                    headerTintColor: "#fff",
                                    headerTitleStyle: { fontWeight: "800" },
                                }}
                            />
                            <Stack.Screen name="Privacy" component={PrivacyScreen} />
                            <Stack.Screen name="Terms" component={TermsScreen} />
                            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
                            <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />



                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
