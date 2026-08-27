import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import useThemedStyles from "./useThemedStyles";

/**
 * SegmentedTabs — a two-or-more way switch styled like the appearance toggle in
 * Settings, used for the Assistant's "AI Tasks / My Tasks" split.
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
            backgroundColor: t.colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.separator,
        },
        label: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13 },
        labelActive: { color: t.colors.textPrimary },
        badge: {
            minWidth: 20,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 9,
            backgroundColor: t.colors.separator,
            alignItems: "center",
        },
        badgeText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 11 },
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
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{option.badge}</Text>
                            </View>
                        ) : null}
                    </Pressable>
                );
            })}
        </View>
    );
}

export default React.memo(SegmentedTabs);
