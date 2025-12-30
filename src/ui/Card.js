import React from "react";
import { View } from "react-native";

export default function Card({ children }) {
  return (
    <View style={{ padding: 14, borderRadius: 14, backgroundColor: "#fff", marginBottom: 12, borderWidth: 1, borderColor: "#eee" }}>
      {children}
    </View>
  );
}
