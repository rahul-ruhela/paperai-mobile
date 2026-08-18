import React, { useEffect, useState } from "react";
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert, KeyboardAvoidingView,
    Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { api } from "../api/client";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
export default function ProfileScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/profile")
            .then(res => setData(res.data))
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        try {
            await api.post("/api/profile", data);
            Alert.alert("Saved", "Profile updated successfully");
        } catch {
            Alert.alert("Error", "Failed to save profile");
        }
    }

    if (loading) return null;

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
                    <Text style={styles.title}>Profile</Text>
                    <Text style={styles.subtitle}>Your personal information</Text>

                    <Card title="Account">
                        {data.isAppleUser && (
                            <View style={styles.appleBadge}>
                                <Ionicons name="logo-apple" size={16} color={theme.colors.white} accessibilityLabel="Apple" />
                                <Text style={styles.appleBadgeText}>Signed in with Apple</Text>
                            </View>
                        )}
                        <ReadOnly
                            label="Email"
                            value={data.email || (data.isAppleUser ? "Private (Apple)" : "—")}
                        />
                        <ReadOnly label="Phone" value={data.phone || "—"} />
                    </Card>

                    <Card title="Personal">
                     {/*   <ReadOnly label="FullName" value={data.fullName || "—"} />*/}
                        <Input label="Full Name" k="fullName"  data={data} setData={setData} />
                        <Input label="Profession" k="profession" data={data} setData={setData} />
                        <Input label="Primary Use Case" k="primaryUseCase" data={data} setData={setData} />
                        <Input label="Company / School" k="companyOrSchool" data={data} setData={setData} />
                    </Card>

                    <Card title="Address">
                        <Input label="Address Line 1" k="addressLine1" data={data} setData={setData} />
                        <Input label="Address Line 2" k="addressLine2" data={data} setData={setData} />
                        <Input label="City" k="city" data={data} setData={setData} />
                        <Input label="State" k="state" data={data} setData={setData} />
                        <Input label="Postal Code" k="postalCode" data={data} setData={setData} />
                        <Input label="Country" k="country" data={data} setData={setData} />
                    </Card>

                    <AppButton title="Save Changes" onPress={save} />
                </ScrollView>
            </KeyboardAvoidingView>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Card({ title, children }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.card}>
            <Text style={styles.section}>{title}</Text>
            {children}
        </View>
    );
}

function Input({ label, k, data, setData }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={data[k] || ""}
                onChangeText={v => setData({ ...data, [k]: v })}
                style={styles.input}
                placeholderTextColor={theme.colors.textMuted}
                keyboardAppearance={theme.keyboardAppearance}
            />
        </>
    );
}

function ReadOnly({ label, value }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.readOnly}>
                <Text style={styles.readOnlyText}>{value}</Text>
            </View>
        </>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 18, gap: 16 },
    title: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },
    subtitle: { color: t.colors.textMuted, fontWeight: "600" },

    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 20,
        padding: 16,
        gap: 10,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    section: { color: t.colors.accentText, fontSize: 18, fontWeight: "800" },
    label: { color: t.colors.textSecondary, fontWeight: "700" },

    input: {
        backgroundColor: t.colors.inputBg,
        borderWidth: 1,
        borderColor: t.colors.inputBorder,
        borderRadius: 14,
        padding: 14,
        color: t.colors.textPrimary,
        fontWeight: "600",
        minHeight: 52,
    },

    readOnly: {
        backgroundColor: t.colors.glassSoft,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: 14,
        padding: 14,
    },
    readOnlyText: {
        color: t.colors.textSecondary,
        fontWeight: "600",
    },
    appleBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        // Apple's brand mark stays black in both appearances; the hairline
        // keeps it from disappearing into a dark card.
        backgroundColor: "#111111",
        borderWidth: t.isDark ? 1 : 0,
        borderColor: t.colors.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignSelf: "flex-start",
    },
    appleBadgeText: {
        color: t.colors.white,
        fontWeight: "700",
        fontSize: 13,
    },
});
