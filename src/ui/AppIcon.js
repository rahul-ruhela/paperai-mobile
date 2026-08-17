import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { AppColors } from "./tokens";

/**
 * Single, consistent icon surface for the whole app.
 *
 * Every icon in the app should go through AppIcon so the icon library,
 * default sizing and default color live in exactly one place. We map
 * semantic names to the installed @expo/vector-icons (Ionicons) set,
 * preferring rounded/outline glyphs for a consistent stroke feel.
 *
 * Sizing guidance:
 *   small   18-20  (inline / metadata)
 *   normal  22-24  (default, buttons, list rows)
 *   feature 28-32  (headers, empty states)
 */

// Semantic name -> Ionicons glyph. Falls back to the raw name if not mapped,
// so existing `<AppIcon name="settings-outline" />` usage keeps working.
const ICONS = {
    // navigation / chrome
    back: "chevron-back",
    forward: "chevron-forward",
    close: "close",
    menu: "menu",
    search: "search-outline",
    settings: "settings-outline",
    profile: "person-circle-outline",
    home: "document-text-outline",

    // actions
    add: "add",
    upload: "cloud-upload-outline",
    download: "download-outline",
    share: "share-outline",
    edit: "create-outline",
    delete: "trash-outline",
    check: "checkmark",
    checkCircle: "checkmark-circle",
    copy: "copy-outline",
    refresh: "refresh-outline",

    // content
    document: "document-text-outline",
    camera: "camera-outline",
    scan: "scan-outline",
    image: "image-outline",
    broom: "sparkles-outline",
    task: "checkbox-outline",

    // status / feedback
    info: "information-circle-outline",
    warning: "warning-outline",
    error: "alert-circle-outline",
    success: "checkmark-circle-outline",
    sparkle: "sparkles",
    star: "star",
    lock: "lock-closed-outline",
    premium: "diamond-outline",

    // auth
    mail: "mail-outline",
    key: "key-outline",
    eye: "eye-outline",
    eyeOff: "eye-off-outline",
    apple: "logo-apple",
};

export default function AppIcon({
    name,
    size = 22,
    color = AppColors.textSecondary,
    style,
    accessibilityLabel,
}) {
    const glyph = ICONS[name] || name;

    return (
        <Ionicons
            name={glyph}
            size={size}
            color={color}
            style={style}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityLabel ? "image" : "none"}
        />
    );
}
