/**
 * Fixes App Store rejection (Guideline 3.1.2): auto-renewable subscriptions must
 * expose a functional Terms of Use (EULA) link in the app's metadata.
 *
 * This appends the standard Apple EULA link to the App Store Description of the
 * current editable version (the one in review / preparation), if it isn't already
 * present. Appending (not replacing) preserves the existing description.
 *
 * SAFE BY DEFAULT: read-only dry-run that prints the current + proposed
 * description. Pass --apply to actually PATCH App Store Connect.
 *
 *   node tools/asc/add-eula-link.js            # dry-run, shows the diff
 *   node tools/asc/add-eula-link.js --apply    # pushes the change to Apple
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY_PATH = process.env.ASC_KEY_PATH
  || [
    path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8"),
    path.join(__dirname, "..", "..", "..", "AuthKey_LY4822XN6Q.p8"),
  ].find((p) => fs.existsSync(p))
  || path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8");
const KEY_ID = "LY4822XN6Q";
const ISSUER_ID = "26a0c1c8-cc00-4398-abb6-b9093adcda60";
const APP_ID = "6757206246";
const BASE = "https://api.appstoreconnect.apple.com";

const EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const EULA_LINE = `Terms of Use (EULA): ${EULA_URL}`;

const APPLY = process.argv.includes("--apply");

function b64url(b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function jwt() {
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const si = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })) + "." +
             b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const s = crypto.sign("sha256", Buffer.from(si), { key, dsaEncoding: "ieee-p1363" });
  return si + "." + b64url(s);
}
async function req(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { Authorization: "Bearer " + jwt(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text(); let json = {}; try { json = txt ? JSON.parse(txt) : {}; } catch {}
  return { status: r.status, ok: r.ok, json, txt };
}
async function get(p) { const r = await req("GET", p); if (!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${r.txt.slice(0, 400)}`); return r.json; }

(async () => {
  // 1) Find the editable version. Prefer states that still allow metadata edits.
  const EDITABLE = new Set([
    "PREPARE_FOR_SUBMISSION", "METADATA_REJECTED", "REJECTED",
    "DEVELOPER_REJECTED", "WAITING_FOR_REVIEW", "PENDING_DEVELOPER_RELEASE",
  ]);
  const versions = (await get(`/v1/apps/${APP_ID}/appStoreVersions?limit=10&fields[appStoreVersions]=versionString,appStoreState`)).data || [];
  console.log("Versions:", versions.map((v) => `${v.attributes.versionString} (${v.attributes.appStoreState})`).join(", ") || "(none)");

  const version = versions.find((v) => EDITABLE.has(v.attributes.appStoreState)) || versions[0];
  if (!version) throw new Error("No app store version found.");
  console.log(`Target version: ${version.attributes.versionString} (${version.attributes.appStoreState})`);
  if (!EDITABLE.has(version.attributes.appStoreState)) {
    console.log("⚠️  This version's state may not allow metadata edits. You may need to create a new version or move it back to 'Prepare for Submission'.");
  }

  // 2) Get its localizations (descriptions per locale).
  const locs = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50&fields[appStoreVersionLocalizations]=locale,description`)).data || [];
  if (locs.length === 0) throw new Error("No localizations found for this version.");

  for (const loc of locs) {
    const locale = loc.attributes.locale;
    const desc = loc.attributes.description || "";

    if (desc.includes(EULA_URL)) {
      console.log(`\n[${locale}] already contains the EULA link — skipping.`);
      continue;
    }

    const newDesc = `${desc.trimEnd()}\n\n${EULA_LINE}\n`;
    console.log(`\n=== [${locale}] ===`);
    console.log("--- current (last 200 chars) ---");
    console.log(desc.slice(-200));
    console.log("--- proposed (last 200 chars) ---");
    console.log(newDesc.slice(-200));

    if (!APPLY) { console.log("(dry-run — not applied)"); continue; }

    const patch = await req("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { description: newDesc } },
    });
    console.log(patch.ok ? `✅ [${locale}] updated.` : `❌ [${locale}] failed ${patch.status}: ${patch.txt.slice(0, 400)}`);
  }

  if (!APPLY) console.log("\nDry-run complete. Re-run with --apply to push to App Store Connect.");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
