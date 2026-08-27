import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import useThemedStyles from "./useThemedStyles";

/**
 * SegmentedTabs — a two-or-more way switch used for the Assistant's
 * "My Tasks / AI Tasks / Reminders" split.
 *
 * The active tab is filled with `primary` rather than merely raised on
 * `surface`: on a glass background a white-on-white pill with a hairline border
 * was almost invisible in light mode, so which tab you were on had to be
 * inferred from the list underneath.
 *
 * Pure presentation: it owns no state, so the screen stays the single source of
 * truth for which tab is showing.
 *
 * Props:
 *   options  [{ key, label, badge? }]
 *   value    key of the active option
 *   onChange (key) => void
 */
const makeStyles = (t) =>
    StyleSheet.create({
        wrap: {
            flexDirection: "row",
            backgroundColor: t.colors.glassSoft,
            borderRadius: 14,
            padding: 4,
            gap: 4,
            marginBottom: 12,
        },
        tab: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 9,
            borderRadius: 11,
        },
        tabActive: {
            backgroundColor: t.colors.primary,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.primaryDark,
            // Lifts the selected pill off the track in both appearances.
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
        },
        label: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13 },
        // onPrimary is the token for text sitting on a primary-filled surface,
        // so this stays readable when the palette changes.
        labelActive: { color: t.colors.onPrimary },
        badge: {
            minWidth: 20,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 9,
            backgroundColor: t.colors.separator,
            alignItems: "center",
        },
        badgeActive: { backgroundColor: "rgba(255,255,255,0.28)" },
        badgeText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 11 },
        badgeTextActive: { color: t.colors.onPrimary },
    });

function SegmentedTabs({ options, value, onChange }) {
    const styles = useThemedStyles(makeStyles);

    return (
        <View style={styles.wrap} accessibilityRole="tablist">
            {options.map((option) => {
                const active = option.key === value;

                return (
                    <Pressable
                        key={option.key}
                        onPress={() => onChange(option.key)}
                        style={[styles.tab, active && styles.tabActive]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={option.label}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>

                        {option.badge > 0 ? (
                            <View style={[styles.badge, active && styles.badgeActive]}>
                                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                                    {option.badge}
                                </Text>
                            </View>
                        ) : null}
                    </Pressable>
                );
            })}
        </View>
    );
}

export default React.memo(SegmentedTabs);
