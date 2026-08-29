import React, { useCallback, useRef, useState } from "react";
import * as MediaLibrary from "expo-media-library";

import PhotoPermissionSheet from "../ui/PhotoPermissionSheet";

/**
 * usePhotoPermission — one compliant path to the photo library.
 *
 * Every screen that reads the library used to call requestPermissionsAsync()
 * directly and explain itself only in the Alert that followed a refusal. iOS
 * shows that dialog once, so the explanation always arrived too late to affect
 * the answer. This hook puts the reason in front of the dialog instead, which
 * is what guideline 5.1.1(i) asks for, and it keeps the pre-prompt rules from
 * PhotoPermissionSheet in one place rather than in four screens.
 *
 * Usage:
 *
 *     const { ensureAccess, permissionSheet } = usePhotoPermission();
 *     ...
 *     const privileges = await ensureAccess({ reason: "…" });
 *     if (!privileges) return;            // user declined; nothing to do
 *     ...
 *     return (<>{content}{permissionSheet}</>);
 *
 * Resolves to "all" | "limited" (both are usable — limited just means partial
 * results) or null when access was not granted. Callers must handle null by
 * doing nothing: the sheet has already told the user where they stand, so an
 * extra Alert on top of it is noise.
 */
export function usePhotoPermission() {
    const [sheet, setSheet] = useState({ visible: false, mode: "explain", reason: "", title: undefined });
    // Held across the await so the sheet's buttons can settle the promise that
    // ensureAccess() returned to the caller.
    const resolver = useRef(null);

    const settle = useCallback((value) => {
        setSheet((s) => ({ ...s, visible: false }));
        const resolve = resolver.current;
        resolver.current = null;
        resolve?.(value);
    }, []);

    const ensureAccess = useCallback(
        async ({ reason, title, writeOnly = false } = {}) => {
            const current = await MediaLibrary.getPermissionsAsync(writeOnly);

            // Already answered yes — never re-explain something that is settled.
            if (current.granted) return current.accessPrivileges ?? "all";

            // Answered no, and iOS will not ask again. Settings is the only
            // remaining route, so the sheet may be dismissed here.
            if (!current.canAskAgain) {
                return new Promise((resolve) => {
                    resolver.current = resolve;
                    setSheet({ visible: true, mode: "denied", reason, title });
                });
            }

            // Undetermined: explain, then always proceed to the system dialog.
            return new Promise((resolve) => {
                resolver.current = resolve;
                setSheet({ visible: true, mode: "explain", reason, title });
            });
        },
        []
    );

    const handleContinue = useCallback(async () => {
        // Hide the explainer first so the iOS dialog is not stacked on top of
        // our own modal — on a real device that reads as two prompts at once.
        setSheet((s) => ({ ...s, visible: false }));
        const perm = await MediaLibrary.requestPermissionsAsync(false);
        const resolve = resolver.current;
        resolver.current = null;
        resolve?.(perm.granted ? perm.accessPrivileges ?? "all" : null);
    }, []);

    const permissionSheet = (
        <PhotoPermissionSheet
            visible={sheet.visible}
            mode={sheet.mode}
            title={sheet.title}
            reason={sheet.reason}
            onContinue={handleContinue}
            onDismiss={() => settle(null)}
        />
    );

    return { ensureAccess, permissionSheet };
}

export default usePhotoPermission;
