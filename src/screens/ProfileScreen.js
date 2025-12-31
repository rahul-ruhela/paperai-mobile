import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";

export default function ProfileScreen({ navigation }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Profile</Text>
                    <Text style={styles.subtitle}>Update your basic account details.</Text>

                    <View style={styles.card}>
                        <Label text="Name" />
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Your name"
                            placeholderTextColor="rgba(255,255,255,0.45)"
                            style={styles.input}
                        />

                        <Label text="Email" />
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email address"
                            placeholderTextColor="rgba(255,255,255,0.45)"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={styles.input}
                        />

                        <Label text="Phone" />
                        <TextInput
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="Phone number"
                            placeholderTextColor="rgba(255,255,255,0.45)"
                            keyboardType="phone-pad"
                            style={styles.input}
                        />
                    </View>

                    <AppButton
                        title="Save Changes"
                        onPress={() => navigation.goBack()}
                    />

                    <Text style={styles.note}>
                        UI only for now. Hook up API later without changing the layout.
                    </Text>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Label({ text }) {
    return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
        gap: 10,
    },
    label: { color: "#A5B4FC", fontWeight: "900" },
    input: {
        backgroundColor: "rgba(0,0,0,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        color: "#fff",
        fontWeight: "700",
    },

    note: {
        marginTop: 6,
        textAlign: "center",
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
        fontWeight: "700",
    },
});
