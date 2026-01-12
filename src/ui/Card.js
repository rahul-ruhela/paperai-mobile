import React from "react";
import { View } from "react-native";
import { Theme } from "./theme";

export default function Card({ children, style }) {
    return (
        <View
            style={[
                {
                    backgroundColor: Theme.colors.surface,
                    borderWidth: 1,
                    borderColor: Theme.colors.border,
                    borderRadius: Theme.radius.lg,
                    padding: 12,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}
