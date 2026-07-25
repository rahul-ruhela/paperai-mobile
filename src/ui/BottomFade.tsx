import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomFade() {
    const insets = useSafeAreaInsets();

    return (
        <View
            pointerEvents="none"
            style={[
                styles.container,
                { height: 80 + insets.bottom },
            ]}
        >
            <LinearGradient
                colors={[
                    "rgba(245,247,251,0)",
                    "rgba(245,247,251,0.65)",
                    "rgba(245,247,251,1)",
                ]}
                style={StyleSheet.absoluteFill}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
});
