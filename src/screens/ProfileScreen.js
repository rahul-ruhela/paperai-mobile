import React, { useEffect, useState } from "react";
import {
    View, Text, TextInput, StyleSheet, ScrollView, Alert, KeyboardAvoidingView,
    Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";
import { api } from "../api/client";

export default function ProfileScreen() {
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
                                <Ionicons name="logo-apple" size={16} color="#fff" />
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
    return (
        <View style={styles.card}>
            <Text style={styles.section}>{title}</Text>
            {children}
        </View>
    );
}

function Input({ label, k, data, setData }) {
    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={data[k] || ""}
                onChangeText={v => setData({ ...data, [k]: v })}
                style={styles.input}
                placeholderTextColor="rgba(255,255,255,0.4)"
            />
        </>
    );
}

function ReadOnly({ label, value }) {
    return (
        <>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.readOnly}>
                <Text style={styles.readOnlyText}>{value}</Text>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 16 },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.65)", fontWeight: "700" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
        gap: 10,
    },
    section: { color: "#A5B4FC", fontSize: 18, fontWeight: "900" },
    label: { color: "#A5B4FC", fontWeight: "900" },

    input: {
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 14,
        padding: 12,
        color: "#fff",
        fontWeight: "700",
    },

    readOnly: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 12,
    },
    readOnlyText: {
        color: "rgba(255,255,255,0.8)",
        fontWeight: "700",
    },
    appleBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(0,0,0,0.35)",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignSelf: "flex-start",
    },
    appleBadgeText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
    },
});
