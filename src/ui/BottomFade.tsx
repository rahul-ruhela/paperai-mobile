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
                    "rgba(2,6,23,0)",
                    "rgba(2,6,23,0.6)",
                    "rgba(2,6,23,1)",
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
