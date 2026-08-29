import { useEffect, useState } from "react";

import { cachedFirstName, getFirstName } from "../services/profileName";

/**
 * useFirstName — the user's first name for greetings, "" until known.
 *
 * Seeds from the cache so a remount does not flash a nameless greeting, and
 * returns "" rather than null so callers can render it directly.
 */
export function useFirstName() {
    const [firstName, setFirstName] = useState(() => cachedFirstName() ?? "");

    useEffect(() => {
        let alive = true;
        if (cachedFirstName() != null) return undefined;

        getFirstName().then((name) => {
            if (alive) setFirstName(name);
        });

        return () => {
            alive = false;
        };
    }, []);

    return firstName;
}
