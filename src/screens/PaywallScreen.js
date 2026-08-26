/**
 * PaywallScreen — 3-tier Apple subscriptions (Essential / Plus / Advance),
 * each with Weekly / Monthly / Yearly, via real StoreKit 2 (expo-iap).
 *
 * Flow (in a real build — dev-client / TestFlight / App Store):
 *   1. Connect to the App Store, fetch all 9 products.
 *   2. User picks a duration tab, taps a tier → requestPurchase opens Apple's sheet.
 *   3. On success → verify transactionId against /api/billing/ios/verify-transaction-auto
 *      → finishTransaction → refresh the server entitlement.
 *
 * Expo Go: the expo-iap native module doesn't exist there, so we render a
 * read-only version (no crash) — keeps `expo start` working on any OS.
 */

import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Animated,
    ScrollView,
} from "react-native";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";

import { verifyIosTransactionAutoWithRetry, getEntitlement } from "../api/billing";
import { invalidateEntitlements } from "../services/entitlementService";
import {
    recordFailedVerification,
    clearFailedVerification,
    wasPreviouslyUnverified,
} from "../storage/pendingPurchases";
import {
    SUBSCRIPTION_TIERS,
    DURATION_LABELS,
    ALL_SUBSCRIPTION_SKUS,
    productInfoForSku,
} from "../constants/api";
import ScreenContainer from "../ui/ScreenContainer";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
// "storeClient" === running inside Expo Go, where native modules are unavailable.
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

const DURATIONS = ["weekly", "monthly", "yearly"];

// How often to ask the backend whether an in-flight purchase has activated,
// and how long to keep asking before handing the user back control.
const PURCHASE_POLL_MS = 2000;
const PURCHASE_TIMEOUT_MS = 45000;

// How long the new plan gets to appear before we conclude Apple has DEFERRED
// the change to the next renewal date (see the poll in PaywallNative). An
// immediate upgrade normally lands in a few seconds, but server-side
// verification can legitimately run ~15s, so this must clear that comfortably.
const DEFERRED_CHANGE_GRACE_MS = 22000;

// Backend may return either `active` or `isActive` — accept both.
function entitlementIsActive(e) {
    return !!(e?.active ?? e?.isActive);
}

// Human name for a product id — "Plus Monthly" rather than a raw bundle id.
function planLabelForSku(sku) {
    const info = productInfoForSku(sku);
    if (!info) return sku ?? "your plan";
    return `${info.tier.name} ${DURATION_LABELS[info.duration]}`;
}

// The backend has used a few names for the period end across versions; accept
// any of them rather than silently dropping the date from the message.
function periodEndDate(e) {
    const raw =
        e?.expiresAtUtc ??
        e?.expiresAt ??
        e?.expiresDateUtc ??
        e?.renewsAtUtc ??
        e?.currentPeriodEndUtc ??
        null;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function formatPeriodEnd(e) {
    const d = periodEndDate(e);
    if (!d) return null;
    try {
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return d.toDateString();
    }
}

/* =========================================================================
   Public component — picks the right implementation for the environment.
========================================================================= */
export default function PaywallScreen(props) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    if (IS_EXPO_GO) return <PaywallExpoGo {...props} />;
    return <PaywallNative {...props} />;
}

/* =========================================================================
   Real purchases (expo-iap) — dev-client / TestFlight / App Store.
========================================================================= */
function PaywallNative({ navigation }) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useIAP, getAvailablePurchases } = require("expo-iap");

    const [loadingSku, setLoadingSku] = useState(null);
    // True once the user taps a plan in THIS session, so a failure that follows
    // their own action is always reported, while launch-time replays stay quiet.
    const purchaseRequestedRef = useRef(false);
    const [entitlement, setEntitlement] = useState(null);
    const [duration, setDuration] = useState("yearly");
    // A plan change Apple has accepted but scheduled for the next renewal date
    // (downgrades and cross-duration changes). Shape: { sku, startsOn }.
    const [pendingChange, setPendingChange] = useState(null);
    // Which product was active at the moment the user tapped Subscribe. Needed
    // to tell "the new plan has not landed yet" apart from "Apple deferred it".
    const previousProductIdRef = useRef(null);
    // True once StoreKit has handed us a transaction for THIS request. A
    // deferred change never produces one, so this is what separates "Apple
    // scheduled it for the renewal date" from "we are still verifying" — the
    // latter can legitimately run past the deferred-change grace window.
    const storeKitRespondedRef = useRef(false);
    // The SKU the user actually tapped. `loadingSku` is state and is captured
    // stale inside the useIAP callbacks, so the comparison that decides whether
    // the purchase delivered the plan that was asked for has to read a ref.
    const requestedSkuRef = useRef(null);
    // A fetch has finished (successfully or not) — until then we show "Loading…"
    // rather than "Unavailable", so a slow StoreKit call doesn't look like a failure.
    const [fetchSettled, setFetchSettled] = useState(false);
    const [fetchFailed, setFetchFailed] = useState(false);

    async function loadEntitlement() {
        try {
            const e = await getEntitlement();
            setEntitlement(e);
            // The scheduled change has landed (or the user changed plans again
            // in App Store settings) — stop advertising it.
            setPendingChange((p) => (p && e?.productId === p.sku ? null : p));
            // Other screens (Settings, feature gates) read a cached snapshot
            // from entitlementService — drop it so they don't show a stale plan.
            invalidateEntitlements();
            return e;
        } catch {
            return null;
        }
    }

    const {
        connected,
        subscriptions,
        fetchProducts,
        requestPurchase,
        finishTransaction,
        restorePurchases,
    } = useIAP({
        // StoreKit re-delivers unfinished transactions on every launch, so this
        // also runs for purchases whose verification failed on a previous run.
        // `finishTransaction` must stay behind a confirmed entitlement: leaving
        // the transaction open is what lets a failed purchase heal itself once
        // the backend is healthy again.
        onPurchaseSuccess: async (purchase) => {
            storeKitRespondedRef.current = true;
            const transactionId = purchase?.transactionId;
            const productId = purchase?.productId ?? purchase?.id ?? null;
            const isReplay = await wasPreviouslyUnverified(transactionId);

            try {
                if (!transactionId) throw new Error("Missing transaction id");

                try {
                    await verifyIosTransactionAutoWithRetry(transactionId);
                } catch (verifyErr) {
                    // The server may have recorded the purchase and still failed
                    // the response. Ask what it actually believes before treating
                    // a paid-for subscription as failed.
                    const current = await loadEntitlement();
                    if (!entitlementIsActive(current)) throw verifyErr;
                    console.warn("[IAP] verify failed but entitlement is active — accepting.");
                }

                await finishTransaction({ purchase, isConsumable: false });
                await clearFailedVerification(transactionId);
                const current = await loadEntitlement();

                // StoreKit answering "success" does NOT mean the user now has
                // the plan they tapped. All nine products share one subscription
                // group, so Apple applies a downgrade — or any move to a shorter
                // billing period — at the next renewal date, and hands back the
                // transaction for the plan that is STILL active. Verifying that
                // transaction re-confirms the OLD plan, so the server correctly
                // reports the old product and its credits. Announcing "your plan
                // is now active" on top of that is what made buying Weekly look
                // like it had granted the Yearly plan's credits: the purchase
                // was fine, the sentence was about the wrong subscription.
                const requestedSku = requestedSkuRef.current;
                const activeSku = current?.productId ?? null;
                const deferredToRenewal =
                    !!requestedSku &&
                    !!activeSku &&
                    activeSku !== requestedSku &&
                    entitlementIsActive(current);

                if (deferredToRenewal) {
                    const startsOn = formatPeriodEnd(current);
                    setPendingChange({ sku: requestedSku, startsOn });
                    Alert.alert(
                        "Plan change scheduled",
                        `${planLabelForSku(requestedSku)} is confirmed and will start ` +
                        (startsOn
                            ? `on ${startsOn}, when your current period ends.`
                            : "when your current billing period ends.") +
                        `\n\nUntil then you keep ${planLabelForSku(activeSku)} and its credits, ` +
                        "and you have not been charged twice. Apple applies downgrades and " +
                        "changes of billing period at the renewal date."
                    );
                    return;
                }

                Alert.alert("Subscribed!", "Your plan is now active. Thank you!", [
                    { text: "Continue", onPress: () => navigation.goBack() },
                ]);
            } catch (err) {
                console.warn(
                    "[IAP] verification failed",
                    `transactionId=${transactionId}`,
                    `status=${err?.response?.status ?? "none"}`,
                    `body=${JSON.stringify(err?.response?.data ?? null)}`
                );

                const isFirstFailure = await recordFailedVerification(transactionId, productId);

                // Silence is only appropriate for a REPLAY the user did not ask
                // for — StoreKit re-delivering an old unfinished transaction at
                // launch. When the user just tapped a plan, they must always be
                // told what happened; suppressing it there is what left a paying
                // customer watching a spinner with no explanation and no
                // transaction id to report.
                const userInitiated = purchaseRequestedRef.current;
                if (userInitiated || (isFirstFailure && !isReplay)) {
                    // An alert with no action is a dead end — it is what App
                    // Review saw and reported as "the purchase failed to
                    // activate subscription". Offer the retry directly.
                    // Include the transaction id and the server's answer. Without
                    // them a failure here is undiagnosable from a user report,
                    // which is exactly the position this bug left us in.
                    const diag =
                        `\n\nTransaction: ${transactionId ?? "unknown"}` +
                        `\nServer: ${err?.response?.status ?? "none"} ` +
                        `${JSON.stringify(err?.response?.data ?? null)}`;

                    Alert.alert(
                        "Activation pending",
                        "Your purchase went through and you have not been charged twice. We could not activate it just yet." + diag,
                        [
                            { text: "Later", style: "cancel" },
                            {
                                text: "Retry now",
                                onPress: async () => {
                                    try {
                                        setLoadingSku("__retry__");
                                        await verifyIosTransactionAutoWithRetry(transactionId);
                                        await finishTransaction({ purchase, isConsumable: false });
                                        await clearFailedVerification(transactionId);
                                        const e = await loadEntitlement();
                                        Alert.alert(
                                            entitlementIsActive(e) ? "Subscribed!" : "Still Activating",
                                            entitlementIsActive(e)
                                                ? "Your plan is now active. Thank you!"
                                                : "Apple has not confirmed it yet. Tap \"Restore Purchases\" in a moment — you will not be charged twice."
                                        );
                                    } catch {
                                        Alert.alert(
                                            "Still Activating",
                                            "Apple has not confirmed it yet. Tap \"Restore Purchases\" in a moment — you will not be charged twice."
                                        );
                                    } finally {
                                        setLoadingSku(null);
                                    }
                                },
                            },
                        ]
                    );
                }
            } finally {
                requestedSkuRef.current = null;
                setLoadingSku(null);
            }
        },
        onPurchaseError: (error) => {
            storeKitRespondedRef.current = true;
            requestedSkuRef.current = null;
            setLoadingSku(null);
            const code = error?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", error?.message ?? "Please try again.");
        },
        onError: (error) => console.warn("[IAP]", error?.message ?? error),
    });

    useEffect(() => {
        loadEntitlement();
    }, []);

    // Reconcile a purchase that is in flight against the server.
    //
    // A plan change inside the subscription group (e.g. moving to Weekly while
    // another tier is active) can settle without onPurchaseSuccess firing the
    // way a first-time purchase does. Nothing would then clear `loadingSku` and
    // the tier button spins forever. Polling the entitlement both fixes that
    // and makes activation feel immediate: the moment the backend reports the
    // plan active we stop the spinner, rather than waiting on StoreKit.
    //
    // It also has to recognise a change Apple has DELIBERATELY not applied yet.
    // Within one subscription group Apple only switches immediately when the
    // new plan is an upgrade; a downgrade, or any move to a different billing
    // period at the same level, is scheduled for the current period's renewal
    // date and the old plan stays active until then. Treating that as a failed
    // purchase — which is what the old "Still processing" alert did — tells a
    // customer who was charged nothing that something went wrong, when in fact
    // Apple did exactly what it was asked to do.
    useEffect(() => {
        if (!loadingSku || loadingSku === "__restore__" || loadingSku === "__retry__") return;

        let cancelled = false;
        let elapsed = 0;

        const timer = setInterval(async () => {
            elapsed += PURCHASE_POLL_MS;

            const current = await loadEntitlement();
            if (cancelled) return;

            // Match on the product, not just "active": when switching plans the
            // previous subscription is still active, so checking activity alone
            // would stop the spinner before the new plan actually took effect.
            const switchedToThisPlan =
                entitlementIsActive(current) && current?.productId === loadingSku;

            if (switchedToThisPlan) {
                clearInterval(timer);
                setLoadingSku(null);
                setPendingChange(null);
                return;
            }

            // Still sitting on the plan the user started from, well past the
            // point an immediate upgrade would have landed → Apple scheduled it.
            const stillOnPreviousPlan =
                entitlementIsActive(current) &&
                !storeKitRespondedRef.current &&
                !!previousProductIdRef.current &&
                current?.productId === previousProductIdRef.current;

            if (stillOnPreviousPlan && elapsed >= DEFERRED_CHANGE_GRACE_MS) {
                clearInterval(timer);
                setLoadingSku(null);

                const startsOn = formatPeriodEnd(current);
                setPendingChange({ sku: loadingSku, startsOn });

                Alert.alert(
                    "Plan change scheduled",
                    `${planLabelForSku(loadingSku)} is confirmed and will start ` +
                    (startsOn
                        ? `on ${startsOn}, when your current period ends.`
                        : "when your current billing period ends.") +
                    `\n\nYou keep ${planLabelForSku(current?.productId)} until then, and you have not been charged twice. ` +
                    "Apple applies downgrades and changes of billing period at the renewal date."
                );
                return;
            }

            if (elapsed >= PURCHASE_TIMEOUT_MS) {
                clearInterval(timer);
                setLoadingSku(null);
                Alert.alert(
                    "Still processing",
                    "Apple has not confirmed this purchase yet. If it completed, tap \"Restore Purchases\" in a moment — you will not be charged twice."
                );
            }
        }, PURCHASE_POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [loadingSku]);

    // NOTE: useIAP's fetchProducts resolves to `undefined` — it pushes its
    // results into the hook's `subscriptions` state instead of returning them.
    // The status therefore has to be derived from `subscriptions`; reading the
    // return value reports "error" even when the store is perfectly healthy.
    async function loadProducts() {
        setFetchSettled(false);
        setFetchFailed(false);
        try {
            await fetchProducts({ skus: ALL_SUBSCRIPTION_SKUS, type: "subs" });
        } catch (e) {
            console.warn("[IAP] fetchProducts failed:", e?.message ?? e);
            setFetchFailed(true);
        } finally {
            setFetchSettled(true);
        }
    }

    useEffect(() => {
        if (!connected) return;
        loadProducts();
    }, [connected]);

    const loadedSkus = new Set((subscriptions ?? []).map((p) => p.id));
    const missingCount = ALL_SUBSCRIPTION_SKUS.filter((sku) => !loadedSkus.has(sku)).length;

    // "loading" | "ready" | "partial" | "error" — drives the products banner.
    let productsStatus;
    if (missingCount === 0) productsStatus = "ready";
    else if (!fetchSettled) productsStatus = "loading";
    else if (loadedSkus.size === 0) productsStatus = "error";
    else productsStatus = "partial";

    useEffect(() => {
        if (!fetchSettled) return;
        const missing = ALL_SUBSCRIPTION_SKUS.filter((sku) => !loadedSkus.has(sku));
        if (missing.length > 0) {
            console.warn(
                `[IAP] StoreKit returned ${loadedSkus.size}/${ALL_SUBSCRIPTION_SKUS.length} SKUs.`,
                `Missing: ${missing.join(", ")}.`,
                fetchFailed ? "(fetchProducts threw)" : ""
            );
        }
    }, [fetchSettled, fetchFailed, missingCount]);

    async function subscribe(sku) {
        if (loadingSku) return;
        if (!connected) {
            Alert.alert("Store unavailable", "Could not reach the App Store. Please try again in a moment.");
            return;
        }
        if (!priceForSku(sku)) {
            Alert.alert(
                "Plan unavailable",
                "This plan could not be loaded from the App Store right now. Please try again in a moment."
            );
            return;
        }
        // Snapshot the plan we are moving away from BEFORE StoreKit runs, so the
        // poll below can recognise a change Apple has scheduled rather than
        // applied. Null when there is nothing active — a first purchase can
        // never be "deferred".
        previousProductIdRef.current = entitlementIsActive(entitlement)
            ? entitlement?.productId ?? null
            : null;

        storeKitRespondedRef.current = false;
        requestedSkuRef.current = sku;
        setLoadingSku(sku);
        purchaseRequestedRef.current = true;
        try {
            await requestPurchase({ request: { apple: { sku } }, type: "subs" });
        } catch (e) {
            setLoadingSku(null);
            const code = e?.code ?? "";
            if (code === "user-cancelled" || code === "E_USER_CANCELLED") return;
            Alert.alert("Purchase failed", e?.message ?? "Please try again.");
        }
    }

    async function restore() {
        if (loadingSku) return;
        setLoadingSku("__restore__");
        try {
            // restorePurchases() only re-delivers through the async
            // onPurchaseSuccess listener. Checking our own entitlement straight
            // afterwards raced that callback and reported "nothing to restore"
            // even when Apple had a live subscription — which is misleading in
            // exactly the situation restore exists for. So ask StoreKit what
            // this Apple ID actually owns, then re-verify it ourselves.
            await restorePurchases();

            let owned = [];
            try {
                owned = (await getAvailablePurchases()) ?? [];
            } catch (listErr) {
                console.warn("[IAP] getAvailablePurchases failed", listErr?.message);
            }

            const failures = [];
            for (const p of owned) {
                const txId = p?.transactionId;
                if (!txId) continue;
                try {
                    await verifyIosTransactionAutoWithRetry(txId);
                    await finishTransaction({ purchase: p, isConsumable: false });
                    await clearFailedVerification(txId);
                } catch (err) {
                    failures.push({
                        txId,
                        status: err?.response?.status ?? "none",
                        body: JSON.stringify(err?.response?.data ?? null),
                    });
                }
            }

            const e = await loadEntitlement();

            if (entitlementIsActive(e)) {
                Alert.alert("Restored", "Your subscription is active.", [
                    { text: "OK", onPress: () => navigation.goBack() },
                ]);
            } else if (owned.length === 0) {
                // Truthful now: StoreKit itself reports nothing for this Apple ID.
                Alert.alert(
                    "Nothing to restore",
                    "This Apple ID has no active Paper AI subscription. If you subscribed with a different Apple ID, sign in with that one and try again."
                );
            } else {
                // Apple DOES have a subscription and we could not confirm it.
                // Saying "nothing to restore" here would be a lie, and it hides
                // the one detail needed to diagnose the failure.
                const f = failures[0] ?? {};
                Alert.alert(
                    "Could not activate",
                    `Apple reports an active subscription for this Apple ID, but our server has not confirmed it yet.\n\n` +
                    `Transaction: ${f.txId ?? owned[0]?.transactionId ?? "unknown"}\n` +
                    `Server: ${f.status ?? "?"} ${f.body ?? ""}\n\n` +
                    `You have not been charged twice. Please send this screen to support.`
                );
            }
        } catch (e) {
            Alert.alert("Restore failed", e?.userMessage ?? e?.message ?? "Please try again.");
        } finally {
            setLoadingSku(null);
        }
    }

    // Only ever show the live App Store price. A product StoreKit didn't
    // return renders as unavailable (never a fabricated static price).
    function priceForSku(sku) {
        const product = subscriptions?.find((p) => p.id === sku);
        return product?.displayPrice ?? null;
    }

    // Numeric price, used only to work out the genuine saving between this
    // tier's billing periods. StoreKit exposes `price` as a number; some
    // versions only populate `displayPrice`, so fall back to parsing that.
    function numericPriceForSku(sku) {
        const product = subscriptions?.find((p) => p.id === sku);
        if (!product) return null;
        if (typeof product.price === "number" && isFinite(product.price)) return product.price;
        const parsed = parseFloat(String(product.displayPrice ?? "").replace(/[^0-9.]/g, ""));
        return isFinite(parsed) ? parsed : null;
    }

    // ISO code (e.g. "USD", "INR") for the customer's storefront, so the
    // comparison figure is formatted the way their currency is normally written.
    function currencyForSku(sku) {
        return subscriptions?.find((p) => p.id === sku)?.currency ?? null;
    }

    return (
        <PaywallView
            duration={duration}
            setDuration={setDuration}
            entitlement={entitlement}
            pendingChange={pendingChange}
            loadingSku={loadingSku}
            productsStatus={productsStatus}
            onRetryProducts={loadProducts}
            priceForSku={priceForSku}
            numericPriceForSku={numericPriceForSku}
            currencyForSku={currencyForSku}
            onSubscribe={subscribe}
            onRestore={restore}
            onOpenTerms={() => navigation.navigate("Terms")}
            onOpenPrivacy={() => navigation.navigate("Privacy")}
        />
    );
}

/* =========================================================================
   Expo Go fallback — read-only, no native module, never crashes.
========================================================================= */
function PaywallExpoGo({ navigation }) {
    const [entitlement, setEntitlement] = useState(null);
    const [duration, setDuration] = useState("yearly");

    useEffect(() => {
        (async () => {
            try {
                setEntitlement(await getEntitlement());
            } catch {
                /* ignore */
            }
        })();
    }, []);

    function notifyUnavailable() {
        Alert.alert(
            "Not available in Expo Go",
            "In-app purchases need the full app build (TestFlight / App Store or an EAS dev build)."
        );
    }

    return (
        <PaywallView
            duration={duration}
            setDuration={setDuration}
            entitlement={entitlement}
            loadingSku={null}
            notice="You're in Expo Go — purchasing is disabled here. Use a TestFlight / App Store build to subscribe."
            productsStatus="ready"
            priceForSku={(sku, fallback) => fallback ?? null}
            numericPriceForSku={() => null}
            currencyForSku={() => null}
            onSubscribe={notifyUnavailable}
            onRestore={notifyUnavailable}
            onOpenTerms={() => navigation.navigate("Terms")}
            onOpenPrivacy={() => navigation.navigate("Privacy")}
        />
    );
}

/* =========================================================================
   Shared presentational view (duration tabs + 3 tier cards).
========================================================================= */
/**
 * The genuine saving a longer billing period gives you, expressed as PRICE PER
 * CREDIT and computed from the LIVE App Store prices of the same tier.
 *
 * Per-credit is the only honest comparison here: a yearly plan costs less than
 * twelve monthly ones but also carries fewer credits, so comparing headline
 * prices would overstate the discount badly. Comparing the rate a customer
 * actually pays for a credit is like-for-like, and Apple rejects reference
 * pricing that overstates a saving (guideline 3.1.1).
 *
 * Returns null whenever the comparison cannot be made honestly.
 */
function savingFor(tier, duration, numericPriceForSku, currencyForSku) {
    if (!numericPriceForSku || duration === "weekly") return null;

    const baseline = duration === "yearly" ? "monthly" : "weekly";
    const here = tier.products[duration];
    const base = tier.products[baseline];
    if (!here?.sku || !base?.sku || !here.credits || !base.credits) return null;

    const herePrice = numericPriceForSku(here.sku);
    const basePrice = numericPriceForSku(base.sku);
    if (!herePrice || !basePrice) return null;

    const hereRate = herePrice / here.credits;
    const baseRate = basePrice / base.credits;
    if (baseRate <= hereRate) return null;

    const percent = Math.round((1 - hereRate / baseRate) * 100);
    if (percent < 5) return null; // not worth a badge

    // Format both rates in the customer's own currency.
    const currency = currencyForSku?.(base.sku);
    const money = (n) => {
        try {
            return currency
                ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n)
                : n.toFixed(2);
        } catch {
            // Unknown currency code, or an engine without full ICU data.
            return n.toFixed(2);
        }
    };

    return { percent, wasLabel: money(baseRate), nowLabel: money(hereRate), baseline };
}

function PaywallView({
    duration,
    setDuration,
    entitlement,
    pendingChange,
    loadingSku,
    notice,
    productsStatus = "ready",
    onRetryProducts,
    priceForSku,
    numericPriceForSku,
    currencyForSku,
    onSubscribe,
    onRestore,
    onOpenTerms,
    onOpenPrivacy,
}) {
    const styles = useThemedStyles(makeStyles);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const isBusyAny = !!loadingSku;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    return (
        <ScreenContainer>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <Text style={styles.header}>Choose your plan</Text>
                <Text style={styles.subHeader}>
                    Credits power document scanning, OCR and AI analysis. Every billing period
                    starts with the full credits for your plan; unused credits do not carry over.
                    Cancel anytime in App Store settings.
                </Text>

                {!!notice && <Text style={styles.notice}>{notice}</Text>}

                {/* What the account is actually on right now. Without this the
                    paywall is silent about the current plan, which is what made
                    a scheduled downgrade look like the purchase had failed. */}
                {entitlementIsActive(entitlement) && (
                    <View style={styles.currentPlan}>
                        <Text style={styles.currentPlanLabel}>CURRENT PLAN</Text>
                        <Text style={styles.currentPlanName}>
                            {planLabelForSku(entitlement?.productId)}
                        </Text>
                        {!!formatPeriodEnd(entitlement) && (
                            <Text style={styles.currentPlanMeta}>
                                {pendingChange
                                    ? `Runs until ${formatPeriodEnd(entitlement)}`
                                    : `Renews ${formatPeriodEnd(entitlement)}`}
                            </Text>
                        )}
                        {!!pendingChange && (
                            <Text style={styles.currentPlanScheduled}>
                                {`${planLabelForSku(pendingChange.sku)} starts ` +
                                    `${pendingChange.startsOn ?? "at renewal"}. ` +
                                    "Apple applies downgrades and billing-period changes at the " +
                                    "renewal date, not immediately."}
                            </Text>
                        )}
                    </View>
                )}

                {(productsStatus === "error" || productsStatus === "partial") && (
                    <View style={styles.productsBanner}>
                        <Text style={styles.productsBannerText}>
                            {productsStatus === "error"
                                ? "Plans could not be loaded from the App Store."
                                : "Some plans are unavailable right now."}
                        </Text>
                        {!!onRetryProducts && (
                            <TouchableOpacity onPress={onRetryProducts} activeOpacity={0.8}>
                                <Text style={styles.productsBannerRetry}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Duration tabs */}
                <View style={styles.tabs}>
                    {DURATIONS.map((d) => {
                        const active = duration === d;
                        return (
                            <TouchableOpacity
                                key={d}
                                onPress={() => setDuration(d)}
                                style={[styles.tab, active && styles.tabActive]}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                    {DURATION_LABELS[d]}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Tier cards */}
                {SUBSCRIPTION_TIERS.map((tier) => {
                    const product = tier.products[duration];
                    const livePrice = priceForSku(product.sku, product.fallbackPrice);
                    const priceUnavailable = livePrice == null;
                    const saving = priceUnavailable
                        ? null
                        : savingFor(tier, duration, numericPriceForSku, currencyForSku);
                    const isActive =
                        entitlementIsActive(entitlement) &&
                        entitlement.productId === product.sku;
                    // Bought and confirmed by Apple, but starts at the next
                    // renewal — not active yet, and not available to re-buy.
                    const isScheduled = !isActive && pendingChange?.sku === product.sku;
                    const isBusyThis = loadingSku === product.sku;
                    const Wrapper = tier.highlight ? Animated.View : View;
                    const wrapperStyle = tier.highlight ? { transform: [{ scale: scaleAnim }] } : null;

                    return (
                        <Wrapper key={tier.id} style={wrapperStyle}>
                            <View
                                style={[
                                    styles.card,
                                    tier.highlight && styles.cardHighlight,
                                    isActive && styles.cardActive,
                                    isScheduled && styles.cardScheduled,
                                ]}
                            >
                                {tier.highlight && (
                                    <View style={styles.popular}>
                                        <Text style={styles.popularText}>MOST POPULAR</Text>
                                    </View>
                                )}

                                <Text style={styles.tierName}>{tier.name}</Text>
                                <Text style={styles.tierTagline}>{tier.tagline}</Text>

                                {priceUnavailable ? (
                                    <Text style={styles.priceUnavailable}>
                                        {productsStatus === "loading" ? "Loading price…" : "Unavailable"}
                                    </Text>
                                ) : (
                                    <>
                                        {saving && (
                                            <View style={styles.saveBadge}>
                                                <Text style={styles.saveBadgeText}>
                                                    SAVE {saving.percent}%
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.price}>
                                            {livePrice}
                                            <Text style={styles.per}> / {duration.replace("ly", "")}</Text>
                                        </Text>
                                        {saving && (
                                            <Text style={styles.saveNote}>
                                                <Text style={styles.priceWas}>{saving.wasLabel}</Text>
                                                {"  "}
                                                {saving.nowLabel} per credit vs {saving.baseline}
                                            </Text>
                                        )}
                                    </>
                                )}
                                <Text style={styles.credits}>{product.credits} credits / cycle</Text>

                                {isScheduled && (
                                    <Text style={styles.scheduledNote}>
                                        {`Scheduled — starts ${
                                            pendingChange.startsOn ??
                                            "when your current period ends"
                                        }.`}
                                    </Text>
                                )}

                                <GradientCTA
                                    onPress={() => onSubscribe(product.sku)}
                                    busy={isBusyThis}
                                    disabled={isActive || isScheduled || isBusyAny || priceUnavailable}
                                    label={
                                        isActive
                                            ? "ACTIVE PLAN"
                                            : isScheduled
                                            ? "STARTS AT RENEWAL"
                                            : priceUnavailable
                                            ? "UNAVAILABLE"
                                            : "Subscribe"
                                    }
                                />
                            </View>
                        </Wrapper>
                    );
                })}

                <TouchableOpacity
                    onPress={onRestore}
                    disabled={isBusyAny}
                    style={{ opacity: isBusyAny ? 0.5 : 1 }}
                >
                    <Text style={styles.restore}>
                        {loadingSku === "__restore__" ? "Restoring…" : "Restore Purchases"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.legal}>
                    Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
                    current period. Manage or cancel in App Store › Account › Subscriptions. Payment is
                    charged to your Apple ID at confirmation of purchase.
                </Text>

                <View style={styles.legalLinks}>
                    <TouchableOpacity onPress={onOpenTerms}>
                        <Text style={styles.legalLink}>Terms of Use</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalLinkDot}>·</Text>
                    <TouchableOpacity onPress={onOpenPrivacy}>
                        <Text style={styles.legalLink}>Privacy Policy</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

// ── Subscription CTA — PaperAI blue gradient with gentle press animation ──────
function GradientCTA({ onPress, busy, disabled, label }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const scale = useRef(new Animated.Value(1)).current;

    const pressIn = () =>
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 45, bounciness: 0 }).start();
    const pressOut = () =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 45, bounciness: 6 }).start();

    // Disabled (active plan / unavailable) → flat muted button, no glow.
    if (disabled && !busy) {
        return (
            <View
                style={[styles.cta, styles.ctaDisabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={label}
            >
                <Text style={styles.ctaText}>{label}</Text>
            </View>
        );
    }

    return (
        <Animated.View style={[styles.ctaGlow, { transform: [{ scale }] }]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={busy}
                activeOpacity={0.92}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <LinearGradient
                    colors={["#1D4ED8", "#2563EB", "#38BDF8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cta}
                >
                    {busy ? (
                        <ActivityIndicator color={theme.colors.white} />
                    ) : (
                        <Text style={styles.ctaText}>{label}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { flexGrow: 1, padding: 24 },
    header: { color: t.colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 6 },
    subHeader: { color: t.colors.textMuted, fontSize: 14, marginBottom: 18 },
    notice: {
        color: t.colors.warningText,
        backgroundColor: t.colors.warningBg,
        borderColor: t.colors.warningBorder,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 18,
    },

    tabs: {
        flexDirection: "row",
        backgroundColor: t.colors.glassButton,
        borderColor: t.colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
    },
    tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", minHeight: 44, justifyContent: "center" },
    tabActive: { backgroundColor: t.colors.primary },
    tabText: { color: t.colors.textSecondary, fontWeight: "700", fontSize: 13 },
    tabTextActive: { color: t.colors.white },

    card: {
        backgroundColor: t.colors.glass,
        borderColor: t.colors.glassBorder,
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    cardHighlight: { borderColor: t.colors.primary, backgroundColor: t.colors.infoBg },
    cardActive: { borderColor: t.colors.success },
    cardScheduled: { borderColor: t.colors.warning },
    scheduledNote: {
        color: t.colors.warningText,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 10,
    },

    currentPlan: {
        backgroundColor: t.colors.successBg,
        borderColor: t.colors.successBorder,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
    },
    currentPlanLabel: {
        color: t.colors.successText,
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 0.8,
    },
    currentPlanName: {
        color: t.colors.textPrimary,
        fontSize: 17,
        fontWeight: "800",
        marginTop: 2,
    },
    currentPlanMeta: { color: t.colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
    currentPlanScheduled: {
        color: t.colors.warningText,
        fontSize: 12,
        fontWeight: "600",
        lineHeight: 17,
        marginTop: 8,
    },
    popular: {
        alignSelf: "flex-start",
        backgroundColor: t.colors.accent,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginBottom: 8,
    },
    popularText: { color: t.colors.textPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

    tierName: { color: t.colors.textPrimary, fontSize: 22, fontWeight: "800" },
    tierTagline: { color: t.colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 12 },
    price: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },
    // The struck-through figure is the real cost of the shorter plan over the
    // same span — see savingFor(). Never a fabricated "was" price.
    priceWas: {
        color: t.colors.textMuted,
        fontSize: 17,
        fontWeight: "600",
        textDecorationLine: "line-through",
    },
    saveBadge: {
        alignSelf: "flex-start",
        backgroundColor: t.colors.accentText,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 6,
    },
    saveBadgeText: {
        color: t.isDark ? "#0B1220" : "#FFFFFF",
        fontSize: 11,
        fontWeight: "900",
        letterSpacing: 0.6,
    },
    saveNote: { color: t.colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2 },
    priceUnavailable: { color: t.colors.textMuted, fontSize: 20, fontWeight: "700", fontStyle: "italic" },
    per: { color: t.colors.textMuted, fontSize: 14, fontWeight: "600" },
    credits: { color: t.colors.accentText, fontSize: 14, fontWeight: "700", marginTop: 4, marginBottom: 14 },

    cta: {
        borderRadius: 14,
        paddingVertical: 16,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
    },
    // Wrapper carries the rounded corners + subtle blue glow around the gradient.
    ctaGlow: {
        borderRadius: 14,
        shadowColor: t.colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 6,
    },
    ctaDisabled: { backgroundColor: t.colors.disabled },
    ctaText: { color: t.colors.white, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },

    restore: {
        marginTop: 10,
        color: t.colors.accentText,
        textAlign: "center",
        textDecorationLine: "underline",
        fontSize: 14,
        fontWeight: "600",
    },
    legal: {
        marginTop: 20,
        color: t.colors.textMuted,
        fontSize: 11,
        textAlign: "center",
        lineHeight: 16,
    },
    legalLinks: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
        paddingBottom: 40,
        gap: 8,
    },
    legalLink: {
        color: t.colors.accentText,
        fontSize: 12,
        fontWeight: "600",
        textDecorationLine: "underline",
    },
    legalLinkDot: { color: t.colors.textMuted, fontSize: 12 },

    productsBanner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: t.colors.dangerBg,
        borderColor: t.colors.dangerBorder,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
    },
    productsBannerText: {
        color: t.colors.dangerText,
        fontSize: 12,
        fontWeight: "600",
        flex: 1,
        marginRight: 10,
    },
    productsBannerRetry: {
        color: t.colors.dangerText,
        fontSize: 12,
        fontWeight: "800",
        textDecorationLine: "underline",
    },
});
