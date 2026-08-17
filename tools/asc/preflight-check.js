/**
 * Read-only pre-submission check for common App Review trip-ups:
 *   1. Privacy Policy URL present on every App Info localization.
 *   2. Every subscription has a review screenshot and isn't stuck in
 *      MISSING_METADATA.
 * Makes no changes. Usage: node tools/asc/preflight-check.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY_PATH = process.env.ASC_KEY_PATH
  || [
    path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8"),
    path.join(__dirname, "..", "..", "..", "AuthKey_LY4822XN6Q.p8"),
  ].find((p) => fs.existsSync(p));
const KEY_ID = "LY4822XN6Q";
const ISSUER_ID = "26a0c1c8-cc00-4398-abb6-b9093adcda60";
const APP_ID = "6757206246";
const BASE = "https://api.appstoreconnect.apple.com";

function b64url(b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function jwt() {
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const si = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" })) + "." +
             b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const s = crypto.sign("sha256", Buffer.from(si), { key, dsaEncoding: "ieee-p1363" });
  return si + "." + b64url(s);
}
async function req(method, p) {
  const r = await fetch(BASE + p, { method, headers: { Authorization: "Bearer " + jwt() } });
  const txt = await r.text(); let json = {}; try { json = txt ? JSON.parse(txt) : {}; } catch {}
  return { status: r.status, ok: r.ok, json, txt };
}
async function get(p) { const r = await req("GET", p); if (!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${r.txt.slice(0, 300)}`); return r.json; }
async function getAll(p) { let out = [], n = p; while (n) { const b = await get(n.startsWith("http") ? n.slice(BASE.length) : n); out = out.concat(b.data ?? []); n = b.links?.next ? b.links.next.slice(BASE.length) : null; } return out; }

(async () => {
  console.log("=== 1. Privacy Policy URL (App Info localizations) ===");
  const appInfos = (await get(`/v1/apps/${APP_ID}/appInfos?limit=10`)).data || [];
  let ppOk = true;
  for (const ai of appInfos) {
    const locs = await getAll(`/v1/appInfos/${ai.id}/appInfoLocalizations?limit=50&fields[appInfoLocalizations]=locale,privacyPolicyUrl`);
    for (const l of locs) {
      const url = l.attributes.privacyPolicyUrl;
      console.log(`  [${l.attributes.locale}] privacyPolicyUrl: ${url || "❌ MISSING"}`);
      if (!url) ppOk = false;
    }
  }
  console.log(ppOk ? "  ✅ Privacy Policy URL present." : "  ❌ Set a Privacy Policy URL in App Information.");

  console.log("\n=== 2. Subscriptions — state + review screenshot ===");
  const groups = await getAll(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const subs = [];
  for (const g of groups) subs.push(...await getAll(`/v1/subscriptionGroups/${g.id}/subscriptions?limit=200&fields[subscriptions]=productId,state,name`));
  let subOk = true;
  for (const s of subs) {
    const pid = s.attributes.productId;
    const state = s.attributes.state;
    const shot = await req("GET", `/v1/subscriptions/${s.id}/appStoreReviewScreenshot`);
    const hasShot = !!shot.json?.data;
    const flag = (state === "MISSING_METADATA" || !hasShot) ? "⚠️ " : "✅";
    console.log(`  ${flag} ${pid}: state=${state}, screenshot=${hasShot ? "yes" : "NO"}`);
    if (state === "MISSING_METADATA" || !hasShot) subOk = false;
  }
  console.log(subOk ? "  ✅ All subscriptions have screenshots and are past MISSING_METADATA." : "  ⚠️ Some subs need a screenshot (run upload-review-screenshots.js) or metadata.");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
