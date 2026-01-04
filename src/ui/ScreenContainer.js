import React from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomFade from "./BottomFade";

export default function ScreenContainer({ children }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.root}>
            <View
                style={[
                    styles.content,
                    { paddingBottom: insets.bottom + 80 },
                ]}
            >
                {children}
            </View>

            <BottomFade />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#020617",
    },
    content: {
        flex: 1,
    },
});
