import React from "react";
import { Pressable, Text } from "react-native";

export default function AppButton({ title, onPress, disabled }) {
  return (
   <Pressable
  onPress={onPress}
  disabled={disabled}
  style={{
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: disabled ? "#A5B4FC" : "#4F46E5",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  }}
> 
  <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>{title}</Text>
</Pressable>
  );
}
