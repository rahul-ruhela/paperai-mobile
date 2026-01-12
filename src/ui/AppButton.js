import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "./theme";

export default function AppButton({ title, onPress, disabled, icon = "add" }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                {
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    backgroundColor: disabled ? "rgba(165,180,252,0.45)" : Theme.colors.primary,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                },
                pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name={icon} size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "950", fontSize: 14 }}>{title}</Text>
            </View>
        </Pressable>
    );
}
