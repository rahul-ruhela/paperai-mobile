import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

import GradientScreen from "../ui/GradientScreen";
import ConfirmActionSheet from "../ui/ConfirmActionSheet";
import { PrimaryButton } from "../ui/buttons";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import {
    VAULT_CRYPTO_INFO,
    canSecureVault,
    createVaultKey,
    destroyVaultKey,
    unlockVaultKey,
} from "../services/vaultCrypto";
import {
    MAX_ITEM_BYTES,
    addItem,
    destroyVault,
    openItem,
    readIndex,
    releaseAllTempFiles,
    releaseTempFile,
    removeItem,
    vaultExists,
} from "../services/vaultStore";
import { formatSize } from "../services/cleanerService";

/**
 * VaultScreen — the Private Vault (Module 5, §2).
 *
 * Five states, and the distinctions between them are the product:
 *
 *   checking      reading whether a vault and biometrics exist
 *   no-biometry   this device cannot secure a vault, and we say why
 *   setup         no vault yet — explain the trade-off BEFORE creating one
 *   locked        a vault exists; nothing about its contents is on screen
 *   unlocked      the list, for as long as the screen stays in front
 *
 * The locked state shows no names, no count, no thumbnails. That is spec §7.2
 * and it is not merely a UI choice — without the key there is nothing to show,
 * because the index itself is encrypted.
 *
 * Auto-lock is real: on backgrounding, and after AUTO_LOCK_MS in the foreground
 * without interaction. Locking drops the key and deletes every decrypted temp
 * file, so a vault left open on a desk closes itself and leaves nothing readable
 * in the cache.
 *
 * What this screen tells the truth about, per spec §6.2 — no "military-grade",
 * no "bank-level":
 *   • Adding encrypts a COPY. The original stays where it was, and we say so.
 *   • The key never leaves this device and is not in any backup. Losing the
 *     device loses the vault, said before the first file is added, not after.
 *   • Screenshots are not blocked, because iOS gives no supported way to.
 */

const AUTO_LOCK_MS = 60_000;

export default function VaultScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [phase, setPhase] = useState("checking");
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(null);
    const [preview, setPreview] = useState(null); // { uri, entry }
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [confirmDestroy, setConfirmDestroy] = useState(false);

    // The key lives in a ref, not in state: it must never be a render input, and
    // dropping it is what "locked" actually means.
    const keyRef = useRef(null);
    const lockTimer = useRef(null);
    const mounted = useRef(true);

    const lock = useCallback(async (reason) => {
        keyRef.current = null;
        if (lockTimer.current) clearTimeout(lockTimer.current);
        setItems([]);
        setPreview(null);
        await releaseAllTempFiles();
        if (!mounted.current) return;
        setPhase((prev) => (prev === "no-biometry" || prev === "setup" ? prev : "locked"));
        if (reason) setBusy(null);
    }, []);

    /** Any interaction pushes the auto-lock back out to a full interval. */
    const touch = useCallback(() => {
        if (!keyRef.current) return;
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => lock("idle"), AUTO_LOCK_MS);
    }, [lock]);

    useEffect(() => {
        mounted.current = true;

        (async () => {
            if (!canSecureVault()) {
                setPhase("no-biometry");
                return;
            }
            setPhase((await vaultExists()) ? "locked" : "setup");
        })();

        // Backgrounding locks immediately. A decrypted temp file outliving the
        // foreground is exactly what the vault exists to prevent, and the cache
        // is not covered by the Keychain gate.
        const sub = AppState.addEventListener("change", (next) => {
            if (next !== "active") lock("background");
        });

        return () => {
            mounted.current = false;
            if (lockTimer.current) clearTimeout(lockTimer.current);
            keyRef.current = null;
            releaseAllTempFiles();
            sub.remove();
        };
    }, [lock]);

    const refreshList = useCallback(async () => {
        if (!keyRef.current) return;
        const index = await readIndex(keyRef.current);
        if (mounted.current) setItems(index);
    }, []);

    async function unlock() {
        setBusy("unlock");
        try {
            keyRef.current = await unlockVaultKey();
            await refreshList();
            setPhase("unlocked");
            touch();
        } catch (err) {
            keyRef.current = null;
            if (err?.code === "NO_VAULT") {
                setPhase("setup");
            } else {
                // Deliberately says nothing beyond "not unlocked" — no attempt
                // count, no hint about contents.
                Alert.alert("Not unlocked", "Your Vault stayed locked.");
            }
        } finally {
            setBusy(null);
        }
    }

    async function setup() {
        setBusy("setup");
        try {
            keyRef.current = await createVaultKey();
            setItems([]);
            setPhase("unlocked");
            touch();
        } catch (err) {
            if (err?.message === "NO_BIOMETRY") {
                setPhase("no-biometry");
            } else {
                Alert.alert("Could not set up", "Your Vault was not created. Please try again.");
            }
        } finally {
            setBusy(null);
        }
    }

    async function addFrom(source) {
        touch();
        if (!keyRef.current) return;

        let picked = null;
        if (source === "photo") {
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
            const asset = res.assets?.[0];
            if (res.canceled || !asset) return;
            picked = {
                uri: asset.uri,
                name: asset.fileName || "Photo",
                mimeType: asset.mimeType || "image/jpeg",
            };
        } else {
            const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            const asset = res.assets?.[0];
            if (res.canceled || !asset) return;
            picked = { uri: asset.uri, name: asset.name, mimeType: asset.mimeType };
        }

        setBusy("add");
        try {
            await addItem(keyRef.current, picked);
            await refreshList();
        } catch (err) {
            if (err?.code === "TOO_LARGE") {
                Alert.alert(
                    "File is too large",
                    `The Vault takes files up to ${formatSize(MAX_ITEM_BYTES)}. Encryption runs on this device, and past that size it would appear to hang.`
                );
            } else {
                Alert.alert("Could not add", "That file was not added to your Vault.");
            }
        } finally {
            setBusy(null);
            touch();
        }
    }

    async function view(entry) {
        touch();
        if (!keyRef.current) return;
        setBusy(`open-${entry.id}`);
        try {
            const opened = await openItem(keyRef.current, entry.id);
            if (opened.entry.mimeType?.startsWith("image/")) {
                setPreview(opened);
            } else {
                // Non-images go to the system viewer. The temp file is released
                // as soon as the sheet closes — it is not left in the cache for
                // whatever opened it to keep.
                await Sharing.shareAsync(opened.uri, { mimeType: opened.entry.mimeType });
                await releaseTempFile(opened.uri);
            }
        } catch {
            Alert.alert(
                "Could not open",
                "This item could not be decrypted. It may have been damaged."
            );
        } finally {
            setBusy(null);
            touch();
        }
    }

    async function closePreview() {
        const uri = preview?.uri;
        setPreview(null);
        await releaseTempFile(uri);
        touch();
    }

    async function remove(entry) {
        setConfirmRemove(null);
        if (!keyRef.current) return;
        setBusy(`remove-${entry.id}`);
        try {
            setItems(await removeItem(keyRef.current, entry.id));
        } finally {
            setBusy(null);
            touch();
        }
    }

    async function destroyEverything() {
        setConfirmDestroy(false);
        setBusy("destroy");
        try {
            await destroyVault();
            await destroyVaultKey();
            keyRef.current = null;
            setItems([]);
            setPhase("setup");
        } finally {
            setBusy(null);
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    if (phase === "checking") {
        return (
            <GradientScreen>
                <View style={styles.centre}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </GradientScreen>
        );
    }

    if (phase === "no-biometry") {
        return (
            <GradientScreen>
                <SafeAreaView style={styles.safe} edges={["bottom"]}>
                    <View style={styles.centre}>
                        <Ionicons name="lock-open-outline" size={44} color={theme.colors.textMuted} />
                        <Text style={styles.title}>The Vault needs a device lock</Text>
                        <Text style={styles.body}>
                            Your Vault opens with Face ID, Touch ID or your passcode, and this
                            device has none set up. Paper AI does not offer its own PIN instead —
                            it would be weaker than the lock iOS already provides, and one more
                            secret to lose.
                        </Text>
                        <Text style={styles.body}>
                            Set a passcode in Settings, then come back.
                        </Text>
                    </View>
                </SafeAreaView>
            </GradientScreen>
        );
    }

    if (phase === "setup") {
        return (
            <GradientScreen>
                <SafeAreaView style={styles.safe} edges={["bottom"]}>
                    <View style={styles.centre}>
                        <Ionicons name="shield-outline" size={44} color={theme.colors.primary} />
                        <Text style={styles.title}>Set up your Private Vault</Text>
                        <Text style={styles.body}>
                            Files you add are encrypted with {VAULT_CRYPTO_INFO.cipher}. The key is
                            generated on this device and kept in the iOS Keychain, released only
                            after Face ID, Touch ID or your passcode.
                        </Text>
                        {/* Said before the first file is added, never after. */}
                        <Text style={styles.warn}>
                            The key never leaves this device and is not in any backup or iCloud. If
                            you lose or erase this device, or delete Paper AI, the contents of your
                            Vault cannot be recovered — not by you and not by us.
                        </Text>
                        <Text style={styles.body}>
                            Adding a file encrypts a copy. The original stays wherever it is now,
                            and Paper AI cannot remove it from your Photos for you.
                        </Text>
                        <PrimaryButton
                            title={busy === "setup" ? "Setting up…" : "Create my Vault"}
                            onPress={setup}
                            disabled={busy === "setup"}
                        />
                    </View>
                </SafeAreaView>
            </GradientScreen>
        );
    }

    if (phase === "locked") {
        return (
            <GradientScreen>
                <SafeAreaView style={styles.safe} edges={["bottom"]}>
                    <View style={styles.centre}>
                        <Ionicons name="lock-closed" size={44} color={theme.colors.primary} />
                        <Text style={styles.title}>Your Vault is locked</Text>
                        {/* No count, no names, no thumbnails. There is nothing to
                            show: the index is encrypted with everything else. */}
                        <Text style={styles.body}>
                            Unlock with Face ID, Touch ID or your passcode to see what is inside.
                        </Text>
                        <PrimaryButton
                            title={busy === "unlock" ? "Unlocking…" : "Unlock"}
                            onPress={unlock}
                            disabled={busy === "unlock"}
                        />
                    </View>
                </SafeAreaView>
            </GradientScreen>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <View style={styles.header}>
                    <Text style={styles.headerNote}>
                        {VAULT_CRYPTO_INFO.cipher}, key held in the iOS Keychain on this device
                        only. Locks itself when you leave the app.
                    </Text>
                </View>

                <View style={styles.actions}>
                    <Pressable
                        style={styles.action}
                        accessibilityRole="button"
                        onPress={() => addFrom("document")}
                    >
                        <Ionicons name="document-outline" size={17} color={theme.colors.accentText} />
                        <Text style={styles.actionText}>Add a file</Text>
                    </Pressable>
                    <Pressable
                        style={styles.action}
                        accessibilityRole="button"
                        onPress={() => addFrom("photo")}
                    >
                        <Ionicons name="image-outline" size={17} color={theme.colors.accentText} />
                        <Text style={styles.actionText}>Add a photo</Text>
                    </Pressable>
                </View>

                {busy === "add" ? (
                    <View style={styles.busyRow}>
                        <ActivityIndicator color={theme.colors.primary} />
                        <Text style={styles.body}>Encrypting on this device…</Text>
                    </View>
                ) : null}

                {items.length === 0 ? (
                    <View style={styles.centre}>
                        <Ionicons name="folder-open-outline" size={40} color={theme.colors.textMuted} />
                        <Text style={styles.body}>
                            Your Vault is empty. Anything you add is encrypted here and copied, not
                            moved.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.id}
                        onScrollBeginDrag={touch}
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => (
                            <View style={styles.row}>
                                <Pressable
                                    style={styles.rowMain}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${item.name}`}
                                    onPress={() => view(item)}
                                >
                                    <Ionicons
                                        name={
                                            item.mimeType?.startsWith("image/")
                                                ? "image-outline"
                                                : "document-text-outline"
                                        }
                                        size={18}
                                        color={theme.colors.accentText}
                                    />
                                    <View style={styles.rowText}>
                                        <Text style={styles.rowTitle} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={styles.rowSub}>
                                            {formatSize(item.size)} ·{" "}
                                            {new Date(item.addedAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    {busy === `open-${item.id}` ? (
                                        <ActivityIndicator color={theme.colors.primary} />
                                    ) : null}
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${item.name}`}
                                    onPress={() => setConfirmRemove(item)}
                                    style={styles.rowRemove}
                                >
                                    <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                                </Pressable>
                            </View>
                        )}
                    />
                )}

                <Pressable
                    accessibilityRole="button"
                    onPress={() => lock("manual")}
                    style={styles.lockNow}
                >
                    <Ionicons name="lock-closed-outline" size={15} color={theme.colors.textMuted} />
                    <Text style={styles.lockNowText}>Lock now</Text>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmDestroy(true)}
                    style={styles.destroy}
                >
                    <Text style={styles.destroyText}>Delete Vault and everything in it</Text>
                </Pressable>

                <Modal visible={!!preview} animationType="fade" onRequestClose={closePreview}>
                    <View style={styles.previewWrap}>
                        {preview ? (
                            <Image
                                source={{ uri: preview.uri }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        ) : null}
                        {/* iOS gives no supported way to block screenshots, so
                            the vault says so rather than implying protection it
                            does not have. */}
                        <Text style={styles.previewNote}>
                            A screenshot of this leaves your Vault and lands in Photos.
                        </Text>
                        <PrimaryButton title="Close" onPress={closePreview} />
                    </View>
                </Modal>

                <ConfirmActionSheet
                    visible={!!confirmRemove}
                    title={`Remove ${confirmRemove?.name ?? "this item"}?`}
                    message="This deletes the encrypted copy in your Vault. Anything you added it from is untouched."
                    confirmText="Remove"
                    onCancel={() => setConfirmRemove(null)}
                    onConfirm={() => remove(confirmRemove)}
                />

                <ConfirmActionSheet
                    visible={confirmDestroy}
                    title="Delete your Vault?"
                    message="Every file in the Vault and the key that opens them are deleted from this device. There is no backup and no way to recover them."
                    confirmText="Delete everything"
                    onCancel={() => setConfirmDestroy(false)}
                    onConfirm={destroyEverything}
                />
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1 },
        centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 26 },
        title: { color: t.colors.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
        body: {
            color: t.colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "500",
            textAlign: "center",
        },
        warn: {
            color: t.colors.warningText,
            fontSize: 13,
            lineHeight: 19,
            fontWeight: "700",
            textAlign: "center",
        },

        header: { paddingHorizontal: 18, paddingTop: 12 },
        headerNote: { color: t.colors.textMuted, fontSize: 11, fontWeight: "600", lineHeight: 16 },

        actions: { flexDirection: "row", gap: 10, padding: 16 },
        action: {
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
            backgroundColor: t.colors.infoBg,
        },
        actionText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },

        busyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18 },

        list: { paddingHorizontal: 14, paddingBottom: 18 },
        row: { flexDirection: "row", alignItems: "center" },
        rowMain: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 13,
            paddingHorizontal: 10,
        },
        rowText: { flex: 1 },
        rowTitle: { color: t.colors.textPrimary, fontWeight: "700", fontSize: 14 },
        rowSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12, marginTop: 2 },
        rowRemove: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },

        lockNow: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "center",
            gap: 6,
            minHeight: 44,
        },
        lockNowText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 13 },

        destroy: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginBottom: 6 },
        destroyText: { color: t.colors.danger, fontWeight: "700", fontSize: 12 },

        previewWrap: {
            flex: 1,
            backgroundColor: t.colors.bg ?? "#000",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            padding: 18,
        },
        previewImage: { width: "100%", flex: 1 },
        previewNote: { color: t.colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
    });
