import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import useThemedStyles from "./useThemedStyles";
import { useTheme } from "./ThemeProvider";
import { showEntitlementDenial, useUpgradePrompt } from "./FeatureLock";

import { getFirstName } from "../services/profileName";
import { getVoicePreferences, updateVoicePreferences } from "../api/voice";
import {
    RATES,
    TONES,
    listVoices,
    sampleSentence,
    speak,
    stopSpeaking,
} from "../services/voiceService";

/**
 * VoiceSettingsSection — the Voice Companion panel (Module 7, §5).
 *
 * Three states, and the middle one is the reason this is not just a FeatureLock
 * wrapper:
 *
 *   ADVANCE  full panel: enable, voice, speed, tone, speak-on-tap.
 *   PLUS     the panel is visible and disabled, but "Play sample" WORKS. The
 *            spec's one deliberate departure from a plain tier gate — you can
 *            hear the thing before you pay for it, which is a fairer offer than
 *            a description of a sound.
 *   BELOW    visible, disabled, upgrade sheet on tap.
 *
 * The sample plays through the same code path a real reminder uses, so it is an
 * honest preview rather than a marketing recording.
 */

const TONE_LABELS = {
    [TONES.FRIENDLY]: "Friendly",
    [TONES.NEUTRAL]: "Neutral",
    [TONES.DIRECT]: "Direct",
};

export default function VoiceSettingsSection({ navigation, firstName: firstNameProp }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { prompt: promptUpgrade } = useUpgradePrompt("voice_companion", navigation);

    const [prefs, setPrefs] = useState(null);
    const [voices, setVoices] = useState([]);
    // The greeting is optional: composeSentence omits it entirely when the name
    // is empty, so a failed profile fetch costs a nicety and nothing else.
    const [firstName, setFirstName] = useState(firstNameProp ?? "");
    const [playing, setPlaying] = useState(false);
    // Distinct from "no panel": the SETTINGS could not be loaded, but the panel
    // and its sample still work. Previously one failed request took the whole
    // section away — including "Play sample", which needs no server at all.
    const [prefsFailed, setPrefsFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            // Deliberately NOT Promise.all. Speech synthesis is entirely
            // on-device, so an unreachable API must not be able to silence the
            // sample — that is exactly what it used to do, and it looked like a
            // broken speech feature rather than a failed network call.
            const installed = await listVoices();
            if (alive) setVoices(installed);

            try {
                const loaded = await getVoicePreferences();
                if (alive) setPrefs(loaded);
            } catch {
                // Local defaults, so every control has a sane position and the
                // sample can be played while the settings are unavailable.
                if (alive) {
                    setPrefsFailed(true);
                    setPrefs({
                        available: false,
                        enabled: false,
                        voiceId: "",
                        rate: 1,
                        tone: TONES.FRIENDLY,
                        speakOnTap: true,
                    });
                }
            }

            if (!firstNameProp) {
                // Was reading profile.name; the endpoint returns fullName,
                // so the sample never greeted anyone by name.
                const first = await getFirstName();
                if (alive && first) setFirstName(first);
            }
        })();
        return () => {
            alive = false;
            stopSpeaking();
        };
    }, []);

    const save = useCallback(
        async (patch) => {
            const previous = prefs;
            setPrefs((p) => ({ ...p, ...patch }));
            try {
                const updated = await updateVoicePreferences(patch);
                setPrefs((p) => ({ ...p, ...updated }));
            } catch (err) {
                setPrefs(previous);
                if (!showEntitlementDenial(err, navigation, "voice_companion")) {
                    Alert.alert("Could not save", "That setting was not saved. Please try again.");
                }
            }
        },
        [prefs, navigation]
    );

    async function playSample() {
        if (playing) {
            await stopSpeaking();
            setPlaying(false);
            return;
        }
        setPlaying(true);
        const result = await speak(sampleSentence({ firstName, tone: prefs?.tone }), {
            voiceId: prefs?.voiceId,
            rate: prefs?.rate,
            availableVoiceIds: voices.map((v) => v.id),
            onDone: () => setPlaying(false),
        });
        if (!result.spoken) setPlaying(false);
    }

    if (!prefs) {
        return (
            <View style={styles.card}>
                <Text style={styles.section}>Voice Companion</Text>
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
            </View>
        );
    }

    const unlocked = prefs.available === true;
    // Plus sits one tier below Advance and gets the audible preview.
    const previewOnly = !unlocked;

    const Option = ({ active, label, onPress, disabled }) => (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            onPress={disabled ? promptUpgrade : onPress}
            style={[styles.option, active && styles.optionActive, disabled && styles.optionMuted]}
        >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
        </Pressable>
    );

    return (
        <View style={styles.card}>
            <Text style={styles.section}>Voice Companion</Text>
            <Text style={styles.hint}>
                Reads a reminder aloud when it arrives, using your phone's own voices. Everything
                is spoken on this device — nothing is recorded and nothing is uploaded.
            </Text>

            {/* The Module 3 speaker button on each task card is unaffected by all
                of this and stays available to everyone. Said plainly, because a
                user seeing a locked "Voice Companion" panel would otherwise
                reasonably assume the button they already use is going away. */}
            <Text style={styles.hint}>
                The speaker button on a task always works, on every plan. This panel is about
                reminders speaking by themselves.
            </Text>

            {/* Says which half is unavailable. "Play sample" below still works,
                because nothing about speaking is server-side. */}
            {prefsFailed ? (
                <Text style={styles.hint}>
                    Your saved voice settings could not be loaded, so these controls show
                    defaults and changes will not save. You can still play a sample.
                </Text>
            ) : null}

            <View style={styles.row}>
                <View style={styles.rowText}>
                    <Text style={styles.label}>Speak my reminders</Text>
                    <Text style={styles.hint}>
                        {unlocked
                            ? "Spoken when a reminder arrives while the app is open, or when you tap it."
                            : "Part of Advance. You can still hear a sample below."}
                    </Text>
                </View>
                <Switch
                    value={!!prefs.enabled}
                    onValueChange={(next) => (unlocked ? save({ enabled: next }) : promptUpgrade())}
                />
            </View>

            <View style={styles.group}>
                <Text style={styles.label}>Speed</Text>
                <View style={styles.options}>
                    {RATES.map((rate) => (
                        <Option
                            key={rate}
                            label={`${rate}×`}
                            active={(prefs.rate ?? 1) === rate}
                            disabled={previewOnly}
                            onPress={() => save({ rate })}
                        />
                    ))}
                </View>
            </View>

            <View style={styles.group}>
                <Text style={styles.label}>Tone</Text>
                <Text style={styles.hint}>Changes the wording only, never the facts.</Text>
                <View style={styles.options}>
                    {Object.values(TONES).map((tone) => (
                        <Option
                            key={tone}
                            label={TONE_LABELS[tone]}
                            active={(prefs.tone ?? TONES.FRIENDLY) === tone}
                            disabled={previewOnly}
                            onPress={() => save({ tone })}
                        />
                    ))}
                </View>
            </View>

            {voices.length > 0 ? (
                <View style={styles.group}>
                    <Text style={styles.label}>Voice</Text>
                    <View style={styles.options}>
                        <Option
                            label="System"
                            active={!prefs.voiceId}
                            disabled={previewOnly}
                            onPress={() => save({ voiceId: "" })}
                        />
                        {/* Labelled with whatever the OS says. The app does not
                            invent a gender or a persona for a system voice. */}
                        {voices.slice(0, 6).map((v) => (
                            <Option
                                key={v.id}
                                label={v.name || v.language}
                                active={prefs.voiceId === v.id}
                                disabled={previewOnly}
                                onPress={() => save({ voiceId: v.id })}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            <View style={styles.row}>
                <View style={styles.rowText}>
                    <Text style={styles.label}>Speak when I tap a reminder</Text>
                </View>
                <Switch
                    value={prefs.speakOnTap !== false}
                    onValueChange={(next) =>
                        unlocked ? save({ speakOnTap: next }) : promptUpgrade()
                    }
                />
            </View>

            {/* Works at every tier, on purpose. */}
            <Pressable accessibilityRole="button" onPress={playSample} style={styles.sample}>
                <Ionicons
                    name={playing ? "stop-circle-outline" : "play-circle-outline"}
                    size={18}
                    color={theme.colors.accentText}
                />
                <Text style={styles.sampleText}>
                    {playing ? "Stop" : "Play sample"}
                </Text>
            </Pressable>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        card: {
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            borderRadius: 20,
            padding: 14,
            gap: 10,
        },
        section: {
            color: t.colors.textMuted,
            fontSize: 15,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.4,
        },
        hint: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },
        label: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },

        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        rowText: { flex: 1, gap: 3 },

        group: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.colors.border },
        options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        option: {
            minHeight: 40,
            justifyContent: "center",
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        optionActive: { backgroundColor: t.colors.infoBg, borderColor: t.colors.infoBorder },
        optionMuted: { opacity: 0.55 },
        optionText: { color: t.colors.textSecondary, fontWeight: "700", fontSize: 13 },
        optionTextActive: { color: t.colors.accentText },

        sample: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            marginTop: 4,
        },
        sampleText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },
    });
