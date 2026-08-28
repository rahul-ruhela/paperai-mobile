/**
 * imageSampler — turns a photo into the two small numbers the paid cleaner
 * layers need, without ever holding a decoded full-size image.
 *
 * One native downsample to 64×64 per photo, decoded in JS, produces both signals:
 *
 *   sharpness — variance of the Laplacian over the 64×64 greyscale frame.
 *   hash      — a 64-bit average hash, box-averaged down from the same frame.
 *
 * Doing both from one sample is what keeps the run inside the memory ceiling in
 * docs/smart-cleaner-spec.md §6: a 64×64 greyscale frame is 4 KB, and it is
 * discarded as soon as the two scalars are read off it.
 *
 * Everything here is on-device. No image, thumbnail, hash or path is uploaded or
 * persisted — the spec's §5 requirement, and the reason the paid scans can be
 * described to App Review as local analysis.
 */

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode as decodeJpeg } from "jpeg-js";

import { averageHash, laplacianVariance } from "./cleanerService";
import { base64ToBytes } from "./base64";

/** Edge of the greyscale frame used for sharpness. */
export const SAMPLE_SIZE = 64;
/** Edge of the hash grid. SAMPLE_SIZE must be a whole multiple of it. */
export const HASH_SIZE = 8;

/** ITU-R BT.601 luma from an RGBA buffer. */
export function toGreyscale(rgba, pixelCount) {
    const gray = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        const o = i * 4;
        gray[i] = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) | 0;
    }
    return gray;
}

/**
 * Box-averages a `from`×`from` greyscale frame down to `to`×`to`.
 * Averaging rather than sampling, so a single hot pixel cannot flip a hash bit.
 */
export function boxDownsample(gray, from, to) {
    // Floored, because a platform that hands back a 63 px or 65 px frame instead
    // of the requested 64 would otherwise index the buffer at a fraction and
    // fill the hash with NaN — a silently wrong hash, which is worse than none.
    const factor = Math.max(1, Math.floor(from / to));
    const out = new Uint8Array(to * to);
    for (let y = 0; y < to; y++) {
        for (let x = 0; x < to; x++) {
            let sum = 0;
            let n = 0;
            for (let dy = 0; dy < factor; dy++) {
                for (let dx = 0; dx < factor; dx++) {
                    const sy = y * factor + dy;
                    const sx = x * factor + dx;
                    if (sy >= from || sx >= from) continue;
                    sum += gray[sy * from + sx];
                    n++;
                }
            }
            out[y * to + x] = n === 0 ? 0 : (sum / n) | 0;
        }
    }
    return out;
}

/**
 * Samples one image. Returns `{ hash, sharpness }`, either of which may be null
 * when the image could not be decoded — a photo we could not read is reported as
 * unknown, never guessed at, because the user is being invited to delete it.
 */
export async function sampleImage(uri) {
    try {
        const ref = await ImageManipulator.manipulate(uri)
            .resize({ width: SAMPLE_SIZE, height: SAMPLE_SIZE })
            .renderAsync();
        const result = await ref.saveAsync({
            base64: true,
            format: SaveFormat.JPEG,
            // Highest quality: compression artifacts are high-frequency noise,
            // which is exactly what the sharpness measure is reading.
            compress: 1,
        });

        const bytes = result?.base64 ? base64ToBytes(result.base64) : null;
        if (!bytes) return { hash: null, sharpness: null };

        const decoded = decodeJpeg(bytes, { useTArray: true });
        const { width, height, data } = decoded;
        const gray = toGreyscale(data, width * height);

        return {
            hash: averageHash(boxDownsample(gray, width, HASH_SIZE), HASH_SIZE),
            sharpness: laplacianVariance(gray, width, height),
        };
    } catch {
        return { hash: null, sharpness: null };
    }
}
