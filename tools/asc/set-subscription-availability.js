/**
 * Creates subscriptionAvailability (territory list) for every subscription
 * missing one, copying the exact territory set already active on
 * essential_weekly (the one subscription that's fully configured).
 * Required before a subscription can leave MISSING_METADATA state.
 *
 * Usage: node tools/asc/set-subscription-availability.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEY_PATH = path.join(__dirname, "..", "..", "src", "appstorekey", "AuthKey_LY4822XN6Q.p8");
const KEY_ID = "LY4822XN6Q";
const ISSUER_ID = "26a0c1c8-cc00-4398-abb6-b9093adcda60";
const APP_ID = "6757206246";
const REFERENCE_SUBSCRIPTION_ID = "6785552491"; // essential_weekly — already fully configured
const BASE = "https://api.appstoreconnect.apple.com";

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
  const territories = await getAll(`/v1/subscriptionAvailabilities/${REFERENCE_SUBSCRIPTION_ID}/availableTerritories?limit=200`);
  const territoryData = territories.map(t => ({ type: "territories", id: t.id }));
  console.log(`Reference territory set: ${territoryData.length} territories`);

  const groups = await getAll(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const subs = [];
  for (const g of groups) subs.push(...await getAll(`/v1/subscriptionGroups/${g.id}/subscriptions?limit=200&fields[subscriptions]=productId,state`));

  for (const s of subs) {
    const pid = s.attributes.productId;
    const existing = await req("GET", `/v1/subscriptions/${s.id}/subscriptionAvailability`);
    if (existing.status === 200 && existing.json?.data) { console.log(`${pid}: already has availability, skipping`); continue; }

    const create = await req("POST", "/v1/subscriptionAvailabilities", {
      data: {
        type: "subscriptionAvailabilities",
        attributes: { availableInNewTerritories: true },
        relationships: {
          subscription: { data: { type: "subscriptions", id: s.id } },
          availableTerritories: { data: territoryData },
        },
      },
    });
    console.log(`${pid}: availability set -> ${create.status} ${create.ok ? "OK" : create.txt.slice(0,200)}`);
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
