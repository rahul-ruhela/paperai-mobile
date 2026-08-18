import React from "react";
import { PrimaryButton } from "./buttons";

/**
 * Backwards-compatible wrapper. Existing screens use <AppButton title icon
 * onPress disabled />; it now renders the branded PrimaryButton (blue
 * gradient, press animation, loading/disabled states).
 */
export default function AppButton({ title, onPress, disabled, loading, icon = "add", style }) {
    return (
        <PrimaryButton
            title={title}
            onPress={onPress}
            disabled={disabled}
            loading={loading}
            icon={icon}
            style={style}
        />
    );
}
