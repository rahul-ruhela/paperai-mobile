import React, { useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../ui/AppButton";
import { login } from "../api/auth";

export default function LoginScreen({ navigation, onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

    async function onLogin() {
        try {
            setBusy(true);
            await login(email.trim(), password);
            onAuthed();
        } catch (e) {
            Alert.alert("Login failed", e?.response?.data || e.message);
        } finally {
            setBusy(false);
        }
    }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
              <Text style={{ fontSize: 28, fontWeight: "700" }}>PaperAI</Text>
              <Text style={{ color: "#6B7280", marginBottom: 20 }}>
                  Upload documents. Get instant AI insights.
              </Text>

              <TextInput
                  placeholder="Email address"
                  keyboardType="email-address"
       
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            padding: 12,
          }}
        />

        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            padding: 12,
          }}
        />

          <AppButton 
          title={busy ? "Signing in..." : "Sign in"}
          onPress={onLogin}
          disabled={busy}
        />

              <Text onPress={() => navigation.navigate("OtpLogin")}>
                  Continue with OTP
              </Text>

        <Text
          onPress={() => navigation.navigate("Register")}
          style={{ textAlign: "center", marginTop: 8 }}
        >
          Create an account
        </Text>
      </View>
    </SafeAreaView>
  );
}
