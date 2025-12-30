import React from "react";
import { View, Text, ScrollView } from "react-native";
import Card from "../ui/Card";

export default function DocumentDetailScreen({ route }) {
    const { title, result } = route.params;

    const summary = (result?.summary || "").trim();
    const extractedText = (result?.extractedText || "").trim();
    const hasAnyContent = summary.length > 0 || extractedText.length > 0;

    if (!hasAnyContent) {
        return (
            <View style={{ flex: 1, padding: 16, backgroundColor: "#F9FAFB" }}>
                <Text style={{ fontSize: 18, fontWeight: "600" }}>
                    No content detected
                </Text>
                <Text style={{ marginTop: 8, color: "#6B7280" }}>
                    The document may be scanned, encrypted, or contain very little text.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={{ flex: 1, backgroundColor: "#F9FAFB" }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>

            <Card>
                <Text style={{ fontWeight: "700" }}>Summary</Text>
                <Text style={{ marginTop: 8 }}>
                    {summary.length ? summary : "(Summary was empty — showing extracted text below.)"}
                </Text>
            </Card>

            <Card>
                <Text style={{ fontWeight: "700" }}>Action Items</Text>
                {(result?.actionItems || []).length ? (
                    (result.actionItems || []).map((x, idx) => (
                        <Text key={idx} style={{ marginTop: 6 }}>• {x}</Text>
                    ))
                ) : (
                    <Text style={{ marginTop: 8, color: "#6B7280" }}>No action items found.</Text>
                )}
            </Card>

            <Card>
                <Text style={{ fontWeight: "700" }}>Category</Text>
                <Text style={{ marginTop: 8 }}>{result?.category || "General"}</Text>
            </Card>

            <Card>
                <Text style={{ fontWeight: "700" }}>Extracted Text</Text>
                <Text style={{ marginTop: 8, color: "#6B7280" }}>
                    Length: {extractedText.length}
                </Text>
                <Text style={{ marginTop: 8, color: "#333" }}>
                    {extractedText.slice(0, 3000)}
                    {extractedText.length > 3000 ? "..." : ""}
                </Text>
            </Card>
        </ScrollView>
    );
}
