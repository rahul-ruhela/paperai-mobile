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
import * as SecureStore from "expo-secure-store";
import { getAccessToken } from "./src/storage/tokenStore";
import PaywallScreen from "./src/screens/PaywallScreen";


const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: "#4F46E5",
                tabBarInactiveTintColor: "#9CA3AF",
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
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

export default function App() {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);

    //useEffect(() => {
    //    getAccessToken().then((t) => {
    //        setAuthed(!!t);
    //        setReady(true);
    //    });
    //}, []);

    useEffect(() => {
        (async () => {
            await SecureStore.deleteItemAsync("accessToken");
            await SecureStore.deleteItemAsync("refreshToken");
        })();

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
                        <Stack.Screen
                            name="Login"
                            options={{ headerShown: false }}
                        >
                            {(props) => (
                                <LoginScreen
                                    {...props}
                                    onAuthed={() => setAuthed(true)}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen
                            name="Register"
                            options={{
                                title: "Create account",
                                headerBackTitleVisible: false,
                            }}
                        >
                            {(props) => (
                                <RegisterScreen
                                    {...props}
                                    onAuthed={() => setAuthed(true)}
                                />
                            )}
                        </Stack.Screen>
                    </>
                ) : (
                    <>
                        <Stack.Screen
                            name="Main"
                            component={Tabs}
                            options={{ headerShown: false }}
                        />

                        <Stack.Screen
                            name="Process"
                            component={ProcessScreen}
                            options={{ title: "Processing" }}
                        />

                        <Stack.Screen
                            name="Document"
                            component={DocumentDetailScreen}
                            options={{ title: "Result" }}
                            />

                            <Stack.Screen
                                name="Paywall"
                                component={PaywallScreen}
                                options={{ title: "Upgrade" }}
                            />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
