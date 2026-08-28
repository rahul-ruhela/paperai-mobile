/**
 * privacyScore — the 0–100 advisory number on the Privacy Centre (Module 5, §4).
 *
 * Pure arithmetic over facts the app can already see locally. Nothing about the
 * score is uploaded, and nothing here reads a device API directly — the caller
 * gathers the inputs and passes them in, which is what makes the weighting
 * testable and keeps the scoring rules in one readable place.
 *
 * Deliberately advisory, not a verdict. The spec forbids scare copy and
 * red-alert styling, and the reason is that a security score is a heuristic over
 * five things this app happens to be able to measure — it is not an assessment
 * of whether the user is safe. So every component explains itself in a sentence,
 * every deduction comes with a concrete action, and a missing input scores full
 * marks rather than penalising the user for something we could not read.
 */

/**
 * Component weights, summing to 100. Ordered as the spec lists them, which is
 * also roughly the order of how much each one actually protects the user.
 */
export const COMPONENTS = [
    { key: "sensitive_secured", label: "Sensitive documents secured", weight: 35 },
    { key: "biometric_lock", label: "Vault protected by biometrics", weight: 20 },
    { key: "permissions_minimal", label: "Permissions kept minimal", weight: 20 },
    { key: "old_documents", label: "Old documents cleared", weight: 15 },
    { key: "notification_privacy", label: "Notification previews", weight: 10 },
];

const WEIGHT = Object.fromEntries(COMPONENTS.map((c) => [c.key, c.weight]));

/** Twelve months, the age past which a document counts as stale. */
export const STALE_AFTER_DAYS = 365;

function pct(part, whole) {
    if (!whole) return 1;
    return Math.max(0, Math.min(1, part / whole));
}

/**
 * Scores one component and, when it is not full marks, names the fix.
 *
 * `earned` is a fraction 0–1; the caller turns it into points. `action` is what
 * the Privacy Centre offers as a tappable remediation, or null when there is
 * nothing to do.
 */
function score(input) {
    const {
        sensitiveTotal = 0,
        sensitiveInVault = 0,
        vaultConfigured = false,
        biometryAvailable = null,
        permissions = null,
        totalDocuments = 0,
        staleDocuments = 0,
        lockScreenPreviewHidden = null,
    } = input ?? {};

    const unsecured = Math.max(0, sensitiveTotal - sensitiveInVault);

    const results = [];

    // 1. Sensitive documents secured.
    results.push({
        key: "sensitive_secured",
        earned: sensitiveTotal === 0 ? 1 : pct(sensitiveInVault, sensitiveTotal),
        detail:
            sensitiveTotal === 0
                ? "Nothing on this device looks sensitive so far."
                : unsecured === 0
                  ? `All ${sensitiveTotal} sensitive document${sensitiveTotal === 1 ? "" : "s"} are in your Vault.`
                  : `${unsecured} of ${sensitiveTotal} sensitive document${sensitiveTotal === 1 ? " is" : "s are"} outside your Vault.`,
        action:
            unsecured > 0
                ? {
                      label: `Move ${unsecured} document${unsecured === 1 ? "" : "s"} to your Vault`,
                      route: "PrivacyCenter",
                      target: "sensitive",
                  }
                : null,
    });

    // 2. Biometric lock. Biometry the device does not have is not the user's
    //    fault, so an unavailable sensor scores full marks with an explanation
    //    rather than a permanent deduction they cannot clear.
    const biometryUnknown = biometryAvailable === null;
    results.push({
        key: "biometric_lock",
        earned: biometryUnknown ? 1 : biometryAvailable ? (vaultConfigured ? 1 : 0) : 1,
        detail: biometryUnknown
            ? "Biometric availability has not been read yet."
            : !biometryAvailable
              ? "This device has no biometrics or passcode enrolled, so the Vault uses whatever lock it has."
              : vaultConfigured
                ? "Your Vault opens only after Face ID, Touch ID or your passcode."
                : "Your Vault is not set up yet.",
        action:
            !biometryUnknown && biometryAvailable && !vaultConfigured
                ? { label: "Set up your Vault", route: "Vault", target: "setup" }
                : null,
    });

    // 3. Permissions minimal — a granted permission the app is not using costs
    //    points. Not-asked and denied are both fine; this measures surplus
    //    access, not caution.
    const granted = (permissions ?? []).filter((p) => p.granted);
    const surplus = granted.filter((p) => !p.usedByApp);
    results.push({
        key: "permissions_minimal",
        earned: permissions === null ? 1 : granted.length === 0 ? 1 : 1 - pct(surplus.length, granted.length),
        detail:
            permissions === null
                ? "Permissions have not been read yet."
                : surplus.length === 0
                  ? "Paper AI only has the permissions it actually uses."
                  : `${surplus.length} permission${surplus.length === 1 ? " is" : "s are"} granted but unused.`,
        action:
            surplus.length > 0
                ? { label: "Review app permissions", route: "PermissionCenter", target: null }
                : null,
    });

    // 4. Old documents.
    results.push({
        key: "old_documents",
        earned: totalDocuments === 0 ? 1 : 1 - pct(staleDocuments, totalDocuments),
        detail:
            totalDocuments === 0
                ? "You have no documents stored yet."
                : staleDocuments === 0
                  ? "Nothing in your library is more than a year old."
                  : `${staleDocuments} document${staleDocuments === 1 ? " is" : "s are"} more than a year old.`,
        action:
            staleDocuments > 0
                ? { label: `Review ${staleDocuments} old document${staleDocuments === 1 ? "" : "s"}`, route: "Home", target: null }
                : null,
    });

    // 5. Notification previews.
    results.push({
        key: "notification_privacy",
        earned: lockScreenPreviewHidden === null ? 1 : lockScreenPreviewHidden ? 1 : 0,
        detail:
            lockScreenPreviewHidden === null
                ? "iOS does not let an app read your lock screen preview setting, so this is not scored."
                : lockScreenPreviewHidden
                  ? "Notification details stay hidden on your lock screen."
                  : "Notification details are shown on your lock screen.",
        action:
            lockScreenPreviewHidden === false
                ? { label: "Hide details on the lock screen", route: "Settings", target: "notifications" }
                : null,
    });

    return results;
}

/**
 * The score and everything the Privacy Centre needs to render it.
 *
 * Returns { score, components, actions } where `actions` is at most three, worst
 * component first — the spec asks for up to three concrete things to do, not a
 * list of everything imperfect.
 */
export function computePrivacyScore(input) {
    const components = score(input).map((c) => ({
        ...c,
        label: COMPONENTS.find((x) => x.key === c.key).label,
        weight: WEIGHT[c.key],
        points: Math.round(c.earned * WEIGHT[c.key]),
    }));

    const total = components.reduce((acc, c) => acc + c.points, 0);

    const actions = components
        .filter((c) => c.action)
        // Biggest available gain first: fixing the 35-point component matters
        // more than the 10-point one, whatever order they are declared in.
        .sort((a, b) => b.weight * (1 - b.earned) - a.weight * (1 - a.earned))
        .slice(0, 3)
        .map((c) => ({ ...c.action, componentKey: c.key }));

    return { score: Math.max(0, Math.min(100, total)), components, actions };
}

/**
 * A plain-language band for the score.
 *
 * No "at risk", no "critical", no red. The spec's rule is an advisory number,
 * and alarming language about a heuristic is how a privacy panel turns into a
 * dark pattern that sells reassurance.
 */
export function scoreBand(value) {
    if (value >= 85) return { key: "strong", label: "Strong" };
    if (value >= 60) return { key: "good", label: "Good" };
    if (value >= 35) return { key: "fair", label: "Room to improve" };
    return { key: "basic", label: "Just getting started" };
}

/** True when a document's date is older than STALE_AFTER_DAYS. */
export function isStale(createdAt, now = Date.now()) {
    const t = new Date(createdAt).getTime();
    if (!Number.isFinite(t)) return false;
    return now - t > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
