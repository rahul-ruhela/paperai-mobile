import React from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useFeatureAccess } from "../hooks/useFeatureAccess";
import useThemedStyles from "./useThemedStyles";

/**
 * The shared locked-state primitives for docs/subscription-entitlement-policy.md §5.
 *
 * The policy's first rule is that nothing disappears: a feature the user cannot
 * use is still rendered, dimmed, with a lock and a CTA that names the tier and
 * the benefit. Before this file every screen implemented that rule by hand, and
 * they disagreed — some hid the control outright, and the ones that did show an
 * upsell each wrote their own sentence for it. A paywall that describes the same
 * lock four different ways reads as broken rather than as a product boundary.
 *
 * Two entry points:
 *   useUpgradePrompt(featureKey)  — for a control that is already rendered and
 *                                   only needs the right sheet on tap.
 *   <FeatureLock featureKey>      — wraps a whole entry point and dims it.
 *
 * Neither one authorizes anything. The backend re-checks every paid action; this
 * decides only what the user is told.
 */

/**
 * Returns { allowed, prompt, ...access }. `prompt()` opens the correct sheet for
 * whichever locked state applies and resolves nothing — it is a UI dead end that
 * hands off to the paywall.
 *
 * Callers still guard their action on `allowed`; prompt() is what they do
 * instead of the action, not a permission check.
 */
export function useUpgradePrompt(featureKey, navigation) {
    const access = useFeatureAccess(featureKey);

    function prompt() {
        if (access.allowed) return;

        const buttons = [{ text: "Not now", style: "cancel" }];

        // A lapsed plan gets restore FIRST. The commonest cause of a subscription
        // that looks expired is a reinstall whose receipts have not been replayed
        // yet, and leading with "View plans" invites a second purchase for
        // something the user already owns.
        if (access.showRestore) {
            buttons.push({
                text: "Restore purchases",
                onPress: () =>
                    navigation?.navigate("Paywall", { featureKey, restore: true }),
            });
        }

        buttons.push({
            text: "View plans",
            onPress: () => navigation?.navigate("Paywall", { featureKey }),
        });

        Alert.alert(access.lockTitle, access.lockMessage, buttons);
    }

    return { ...access, prompt };
}

/**
 * Wraps an entry point the user may not have. When allowed, renders `children`
 * untouched and adds no view to the tree. When locked, renders the same children
 * dimmed and non-interactive under a lock badge, with the whole block tappable.
 *
 * `children` are always rendered — never conditionally unmounted — so the
 * feature stays discoverable and the layout does not shift between tiers.
 *
 * Props:
 *   featureKey  matrix key to gate on
 *   navigation  react-navigation prop, for the paywall hand-off
 *   label       optional override for the badge caption
 *   testID      applied to the locked wrapper, so tests can assert presence
 */
export default function FeatureLock({ featureKey, navigation, label, testID, children }) {
    const styles = useThemedStyles(makeStyles);
    const { allowed, loading, lockMessage, tierBadge, prompt } = useUpgradePrompt(
        featureKey,
        navigation
    );

    // While the snapshot is loading, render normally rather than flashing a lock
    // onto something the user has paid for. The action itself is still guarded.
    if (allowed || loading) return children;

    return (
        <Pressable
            onPress={prompt}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`${label ?? "Locked feature"}. ${lockMessage}`}
            // Reported as disabled to assistive tech while staying focusable, so
            // the lock is announced instead of the control silently doing nothing.
            accessibilityState={{ disabled: true }}
            style={styles.wrap}
        >
            <View style={styles.dimmed} pointerEvents="none">
                {children}
            </View>
            <View style={styles.badge}>
                <Ionicons name="lock-closed" size={11} color={styles.badgeText.color} />
                <Text style={styles.badgeText}>{tierBadge}</Text>
            </View>
        </Pressable>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: {
            position: "relative",
        },
        dimmed: {
            // 55% per the policy: legible enough to read what is on offer, dim
            // enough that it is obviously not active.
            opacity: 0.55,
        },
        badge: {
            position: "absolute",
            top: 8,
            right: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: t.colors.glassSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.border,
        },
        badgeText: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.5,
            color: t.colors.textMuted,
        },
    });
