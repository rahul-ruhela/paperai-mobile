/**
 * Apply PaperAI subscription base (USA) prices via the App Store Connect API.
 * Apple auto-equalizes other territories from the USA base once submitted.
 *
 * PREREQUISITE: the Paid Applications Agreement must be ACTIVE (App Store
 * Connect -> Business -> Agreements) and banking/tax complete. Until then,
 * every price write returns HTTP 409 ENTITY_ERROR.RELATIONSHIP.INVALID.
 *
 * Usage:  node tools/asc/apply-subscription-prices.js
 *         node tools/asc/apply-subscription-prices.js --dry   (no writes)
 *
 * Requires Node 18+ (global fetch) and the .p8 key at KEY_PATH below.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY_PATH = path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8");
const KEY_ID = "LY4822XN6Q";
const ISSUER_ID = "26a0c1c8-cc00-4398-abb6-b9093adcda60";
const APP_ID = "6757206246";
const BASE = "https://api.appstoreconnect.apple.com";
const DRY = process.argv.includes("--dry");

// productId -> target USA price (must be an exact Apple price point)
const TARGET_USA_PRICE = {
  "com.bholeshankar.paperai.essential_weekly": 15.99,
  "com.bholeshankar.paperai.essential_monthly": 57.90,
  "com.bholeshankar.paperai.essential_yearly": 459.00,
  "com.bholeshankar.paperai.plus_weekly": 42.49,
  "com.bholeshankar.paperai.plus_monthly": 153.99,
  "com.bholeshankar.paperai.plus_yearly": 699.00,
  "com.bholeshankar.paperai.advance_weekly": 85.00,
  "com.bholeshankar.paperai.advance_monthly": 309.00,
  "com.bholeshankar.paperai.advance_yearly": 899.00,
};

function b64url(b){return Buffer.from(b).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function jwt(){
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_PATH,"utf8"));
  const now = Math.floor(Date.now()/1000);
  const si = b64url(JSON.stringify({alg:"ES256",kid:KEY_ID,typ:"JWT"}))+"."+
             b64url(JSON.stringify({iss:ISSUER_ID,iat:now,exp:now+900,aud:"appstoreconnect-v1"}));
  const s = crypto.sign("sha256", Buffer.from(si), {key, dsaEncoding:"ieee-p1363"});
  return si+"."+b64url(s);
}
async function req(method, path, body){
  const r = await fetch(BASE+path, { method, headers:{ Authorization:"Bearer "+jwt(), "Content-Type":"application/json" }, body: body?JSON.stringify(body):undefined });
  const txt = await r.text(); let json={}; try{json=txt?JSON.parse(txt):{}}catch{}
  return { status:r.status, ok:r.ok, json, txt };
}
async function get(p){ const r=await req("GET",p); if(!r.ok) throw new Error(`GET ${p} -> ${r.status}: ${r.txt.slice(0,200)}`); return r.json; }
async function getAll(p){ let out=[],n=p; while(n){const b=await get(n.startsWith("http")?n.slice(BASE.length):n);out=out.concat(b.data??[]);n=b.links?.next?b.links.next.slice(BASE.length):null;} return out; }

(async () => {
  const groups = await getAll(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const subs = [];
  for (const g of groups) subs.push(...await getAll(`/v1/subscriptionGroups/${g.id}/subscriptions?limit=200`));

  for (const s of subs) {
    const pid = s.attributes.productId;
    const target = TARGET_USA_PRICE[pid];
    if (target == null) { console.log(`${pid}: no target, skipped`); continue; }

    const pts = await getAll(`/v1/subscriptions/${s.id}/pricePoints?filter[territory]=USA&limit=200`);
    const priced = pts.map(p=>({id:p.id,price:parseFloat(p.attributes.customerPrice)})).filter(p=>!isNaN(p.price));
    let best=null,diff=Infinity; for(const p of priced){const d=Math.abs(p.price-target);if(d<diff){diff=d;best=p;}}
    if (!best) { console.log(`${pid}: no USA price point found`); continue; }

    if (DRY) { console.log(`${pid}: would set $${best.price} (target $${target})`); continue; }

    const r = await req("POST", "/v1/subscriptionPrices", {
      data: {
        type: "subscriptionPrices",
        attributes: { preserveCurrentPrice: false, startDate: null },
        relationships: {
          subscription: { data: { type:"subscriptions", id:s.id } },
          subscriptionPricePoint: { data: { type:"subscriptionPricePoints", id:best.id } },
        },
      },
    });
    console.log(`${pid}: set $${best.price} -> ${r.status} ${r.ok?"OK":r.txt.replace(/\s+/g," ").slice(0,160)}`);
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
