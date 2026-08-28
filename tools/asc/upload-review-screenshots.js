/**
 * Uploads the App Store review screenshot to every subscription in the app
 * that's missing one (MISSING_METADATA state, appStoreReviewScreenshot=null).
 * Reuses the same screenshot already accepted for essential_weekly, since
 * the paywall UI is identical across tiers.
 *
 * Usage: node tools/asc/upload-review-screenshots.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY_PATH = path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8");
const KEY_ID = "LY4822XN6Q";
const ISSUER_ID = "26a0c1c8-cc00-4398-abb6-b9093adcda60";
const APP_ID = "6757206246";
const BASE = "https://api.appstoreconnect.apple.com";
const IMAGE_PATH = process.argv[2] || path.join(__dirname, "review_screenshot.jpg");

function b64url(b){return Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function jwt(){
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH,"utf8"));
  const now = Math.floor(Date.now()/1000);
  const si = b64url(JSON.stringify({alg:"ES256",kid:KEY_ID,typ:"JWT"}))+"."+
             b64url(JSON.stringify({iss:ISSUER_ID,iat:now,exp:now+900,aud:"appstoreconnect-v1"}));
  const s = crypto.sign("sha256", Buffer.from(si), {key, dsaEncoding:"ieee-p1363"});
  return si+"."+b64url(s);
}
async function req(method, p, body){
  const r = await fetch(BASE+p, { method, headers:{ Authorization:"Bearer "+jwt(), "Content-Type":"application/json" }, body: body?JSON.stringify(body):undefined });
  const txt = await r.text(); let json={}; try{json=txt?JSON.parse(txt):{}}catch{}
  return { status:r.status, ok:r.ok, json, txt };
}
async function get(p){ const r=await req("GET",p); if(!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${r.txt.slice(0,300)}`); return r.json; }
async function getAll(p){ let out=[],n=p; while(n){const b=await get(n.startsWith("http")?n.slice(BASE.length):n);out=out.concat(b.data??[]);n=b.links?.next?b.links.next.slice(BASE.length):null;} return out; }

(async () => {
  const bytes = fs.readFileSync(IMAGE_PATH);
  const fileSize = bytes.length;
  const fileName = path.basename(IMAGE_PATH);
  const md5 = crypto.createHash("md5").update(bytes).digest("hex");
  console.log(`Screenshot: ${fileName}, ${fileSize} bytes, md5=${md5}`);

  const groups = await getAll(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const subs = [];
  for (const g of groups) subs.push(...await getAll(`/v1/subscriptionGroups/${g.id}/subscriptions?limit=200&fields[subscriptions]=productId,state`));

  for (const s of subs) {
    const pid = s.attributes.productId;
    if (s.attributes.state !== "MISSING_METADATA") { console.log(`${pid}: state=${s.attributes.state}, skipping`); continue; }

    const existing = await req("GET", `/v1/subscriptions/${s.id}/appStoreReviewScreenshot`);
    if (existing.json?.data) { console.log(`${pid}: already has a screenshot, skipping`); continue; }

    const create = await req("POST", "/v1/subscriptionAppStoreReviewScreenshots", {
      data: {
        type: "subscriptionAppStoreReviewScreenshots",
        attributes: { fileName, fileSize },
        relationships: { subscription: { data: { type: "subscriptions", id: s.id } } },
      },
    });
    if (!create.ok) { console.log(`${pid}: CREATE FAILED -> ${create.status} ${create.txt.slice(0,200)}`); continue; }

    const ssId = create.json.data.id;
    const ops = create.json.data.attributes.uploadOperations || [];
    for (const op of ops) {
      const headers = {};
      for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      const chunk = bytes.slice(op.offset, op.offset + op.length);
      const put = await fetch(op.url, { method: op.method || "PUT", headers, body: chunk });
      if (!put.ok) { console.log(`${pid}: UPLOAD CHUNK FAILED -> ${put.status}`); }
    }

    const commit = await req("PATCH", `/v1/subscriptionAppStoreReviewScreenshots/${ssId}`, {
      data: { type: "subscriptionAppStoreReviewScreenshots", id: ssId, attributes: { uploaded: true, sourceFileChecksum: md5 } },
    });
    console.log(`${pid}: screenshot uploaded -> ${commit.status} ${commit.ok ? "OK" : commit.txt.slice(0,200)}`);
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
