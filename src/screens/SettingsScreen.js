import React from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../ui/AppButton";
import { logout } from "../api/auth";

export default function SettingsScreen({ navigation }) {
    async function onLogout() {
        try {
            await logout();

            // HARD RESET navigation to Login
            navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
            });
        } catch (e) {
            Alert.alert("Logout failed", e.message);
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
            <View
                style={{
                    flex: 1,
                    padding: 16,
                    justifyContent: "center",
                    gap: 16,
                }}
            >
                <Text style={{ fontSize: 22, fontWeight: "700" }}>
                    Settings
                </Text>

                <AppButton title="Logout" onPress={onLogout} />

                <Text style={{ color: "#6B7280", fontSize: 13 }}>
                    You will be redirected to the login screen.
                </Text>
            </View>
        </SafeAreaView>
    );
}
