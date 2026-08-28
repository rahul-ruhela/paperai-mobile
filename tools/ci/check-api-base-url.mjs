#!/usr/bin/env node
/**
 * Fails the build when the app's fallback API host is anything a shipped binary
 * must never point at: a LAN/loopback address, or cleartext http://.
 *
 * This exists because neither of the other CI gates can see the problem.
 * `tsc --noEmit` type-checks a string literal happily, and `expo export`
 * bundles it happily — the URL is only ever dereferenced at runtime, on a
 * device, off the developer's Wi-Fi. The failure surfaces to App Review as
 * "the app doesn't work" (guideline 2.1), and cleartext http:// additionally
 * trips App Transport Security. Both are rejections, discovered a week late.
 *
 * It has happened: `prod-new-development` carries
 * `const PRODUCTION_API = "http://192.168.29.223:5263"`, which passes tsc and
 * passes the bundle check.
 *
 * Run locally:  node tools/ci/check-api-base-url.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CONSTANTS = "src/constants/api.ts";

// The one host a production binary may fall back to.
const EXPECTED_FALLBACK = "https://apis.bseptechnologies.com";

const problems = [];

// --- 1. The declared fallback must be exactly the live host -----------------
const source = readFileSync(join(REPO_ROOT, CONSTANTS), "utf8");
const match = source.match(/const\s+PRODUCTION_API\s*=\s*["'`]([^"'`]+)["'`]/);

if (!match) {
    problems.push(
        `${CONSTANTS}: could not find a 'const PRODUCTION_API = "..."' declaration. ` +
        `If it was renamed, update this check — do not delete it.`
    );
} else if (match[1] !== EXPECTED_FALLBACK) {
    problems.push(
        `${CONSTANTS}: PRODUCTION_API is "${match[1]}", expected "${EXPECTED_FALLBACK}".\n` +
        `      A build that falls back anywhere else is dead on every device off ` +
        `your Wi-Fi, App Review's included.`
    );
}

// --- 2. No private / loopback host anywhere in shipped source ---------------
// Matches the RFC1918 + loopback + link-local ranges, and localhost by name.
const BAD_HOST = /\b(?:https?:\/\/)?(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2})\b/;
const CLEARTEXT = /["'`]http:\/\/(?!localhost|127\.)/;

// XML/SVG namespace URIs are identifiers, not endpoints — nothing is fetched
// from them, and "correcting" the scheme breaks parsing, because the namespace
// string is compared literally. `strokesToSvg` in src/ui/SignaturePad.js emits
// xmlns="http://www.w3.org/2000/svg", which is spelled exactly this way by
// spec. Found by running this check against the tier-1 feature branch.
const NAMESPACE_URI = /https?:\/\/(?:www\.)?(?:w3\.org|purl\.org|xmlsoap\.org)\/\S*/g;

function walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            walk(full);
            continue;
        }
        if (!/\.(?:js|jsx|ts|tsx)$/.test(entry)) continue;

        const rel = relative(REPO_ROOT, full);
        const text = readFileSync(full, "utf8");

        text.split("\n").forEach((line, i) => {
            // Comments are documentation, not configuration — the file we are
            // guarding explains the rule in prose and must not trip its own check.
            //
            // The `[^:]` is load-bearing: a naive /\/\/.*$/ strips the "//" in
            // "http://host" too, truncating the line to `const X = "http:` and
            // hiding the exact literal this check exists to find. Requiring the
            // slashes not be preceded by a colon keeps scheme separators intact
            // while still dropping real trailing comments.
            const code = line.replace(/(^|[^:])\/\/.*$/, "$1").replace(/\/\*.*?\*\//g, "");
            if (!code.trim()) return;

            // Strip rather than skip: a line carrying both a namespace URI and
            // a real LAN host must still be caught on the second one.
            const scannable = code.replace(NAMESPACE_URI, "");

            if (BAD_HOST.test(scannable)) {
                problems.push(`${rel}:${i + 1}: private/loopback host in shipped source — ${code.trim()}`);
            } else if (CLEARTEXT.test(scannable)) {
                problems.push(`${rel}:${i + 1}: cleartext http:// URL (App Transport Security) — ${code.trim()}`);
            }
        });
    }
}

walk(join(REPO_ROOT, "src"));

if (problems.length > 0) {
    for (const p of problems) {
        console.error(`::error::${p}`);
    }
    console.error(`\n${problems.length} problem(s). Refusing to build.`);
    process.exit(1);
}

console.log(`API base URL check passed — PRODUCTION_API is ${EXPECTED_FALLBACK}, no private hosts in src/.`);
