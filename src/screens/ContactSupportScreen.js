import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";

export default function ContactSupportScreen() {
    const [message, setMessage] = useState("");

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Contact Support</Text>

                  {/*  <Text style={styles.info}>📞 +1 (800) 555-0199</Text>*/}
                    <Text style={styles.quickDesc}>📞 +1 833 374-3700</Text>
                    {/*<TouchableOpacity style={styles.quickCard} onPress={openPhone}>*/}
                    {/*    <View style={styles.quickIcon}>*/}
                    {/*        <Ionicons name="call-outline" size={26} color={C.success} />*/}
                    {/*    </View>*/}
                    {/*    <Text style={styles.quickTitle}>Call Us</Text>*/}
                    {/*    <Text style={styles.quickDesc}>+1 833 374-3700</Text>*/}
                    {/*</TouchableOpacity>*/}

                    <TextInput
                        placeholder="Describe your issue"
                        placeholderTextColor="rgba(255,255,255,0.45)"
                        multiline
                        value={message}
                        onChangeText={setMessage}
                        style={styles.input}
                    />

                    <AppButton
                        title="Submit Enquiry"
                        onPress={() => alert("Support request submitted")}
                    />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 24, fontWeight: "900" },
    info: { color: "#A5B4FC", fontWeight: "900" },
    input: {
        minHeight: 120,
        backgroundColor: "rgba(0,0,0,0.2)",
        borderRadius: 18,
        padding: 14,
        color: "#fff",
        fontWeight: "700",
    },
});
