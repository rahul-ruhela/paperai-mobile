import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

/**
 * Catches any unhandled JS errors in the component tree and shows a calm
 * fallback screen instead of a white crash. Includes a Retry button that
 * resets the error state so the user can try again without restarting the app.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Log to your crash reporter here if you add Sentry / Bugsnag later
        if (__DEV__) {
            console.error("[ErrorBoundary]", error, info?.componentStack);
        }
    }

    reset = () => this.setState({ hasError: false, error: null });

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <View style={styles.container}>
                <View style={styles.icon}>
                    <Text style={styles.emoji}>⚠️</Text>
                </View>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.body}>
                    We hit an unexpected issue. Your data is safe.{"\n"}
                    Please try again — most issues resolve on their own.
                </Text>
                <Pressable style={styles.btn} onPress={this.reset}>
                    <Text style={styles.btnText}>Try again</Text>
                </Pressable>
                {__DEV__ && this.state.error ? (
                    <Text style={styles.devMsg} numberOfLines={4}>
                        {this.state.error?.toString()}
                    </Text>
                ) : null}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#020617",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
    },
    icon: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: "rgba(239,68,68,0.12)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    emoji: { fontSize: 32 },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
        textAlign: "center",
        marginBottom: 10,
    },
    body: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 28,
    },
    btn: {
        backgroundColor: "#6366f1",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
    },
    btnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
    devMsg: {
        marginTop: 24,
        color: "#ef4444",
        fontSize: 11,
        textAlign: "center",
        fontFamily: "monospace",
    },
});
