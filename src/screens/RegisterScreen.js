import React, { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../ui/AppButton";
import { register } from "../api/auth";

export default function RegisterScreen({ onAuthed }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    try {
      setBusy(true);
      await register(name.trim(), email.trim(), password, phone || null);
      onAuthed();
    } catch (e) {
      Alert.alert("Register failed", e?.response?.data || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>
          Create account
        </Text>

        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
        />
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
        />
        <TextInput
          placeholder="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
        />

        <AppButton
          title={busy ? "Creating..." : "Create"}
          onPress={onRegister}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}
