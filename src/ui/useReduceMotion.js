import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Returns true when the OS "Reduce Motion" preference is enabled.
 * Components should skip or shorten animations when this is true.
 */
export default function useReduceMotion() {
    const [reduce, setReduce] = useState(false);

    useEffect(() => {
        let mounted = true;

        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((enabled) => {
                if (mounted) setReduce(!!enabled);
            })
            .catch(() => {});

        const sub = AccessibilityInfo.addEventListener?.(
            "reduceMotionChanged",
            (enabled) => setReduce(!!enabled)
        );

        return () => {
            mounted = false;
            sub?.remove?.();
        };
    }, []);

    return reduce;
}
