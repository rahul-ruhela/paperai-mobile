# Testing push notifications against a local API

Everything here runs against the API on your Mac. Nothing is deployed, so a bug
found at this stage never reaches a user.

## Why a development build is required

Remote push was **removed from Expo Go in Expo SDK 53**. `expo-notifications`
says so itself:

> Push notifications (remote notifications) functionality provided by
> `expo-notifications` was removed from Expo Go with the release of SDK 53.
> Use a development build instead.

So:

| | Expo Go | Development build | Simulator |
|---|---|---|---|
| Smart Reminders (local notifications) | ✅ | ✅ | ❌ |
| Push token / remote push | ❌ | ✅ | ❌ |

A simulator has no connection to Apple's push service at all. **Push testing
needs a real iPhone running a development build.**

```bash
eas build --profile development --platform ios
```

## 1. Point the app at your Mac

```bash
cp .env.example .env.local
ipconfig getifaddr en0        # your LAN IP, e.g. 192.168.29.135
```

Set in `.env.local`:

```
EXPO_PUBLIC_APP_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://192.168.29.135:5263
```

The phone and the Mac must be on the same Wi-Fi. `app.json` carries
`NSAllowsLocalNetworking`, which is what allows cleartext HTTP to a LAN address —
iOS blocks it otherwise. The first request shows a one-time "find devices on your
local network" prompt; accept it.

## 2. Start the API bound to the network

`localhost` is not reachable from the phone — bind to all interfaces:

```bash
cd ~/webapps/PaperAiApis
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS=http://0.0.0.0:5263 \
dotnet run --project PaperAi.csproj
```

Confirm from the phone's browser: `http://192.168.29.135:5263/health` → `Healthy`.

> `appsettings.Development.json` sets `Notifications:WorkerEnabled: false`.
> Leave it false. Its connection string points at the **live** database, so with
> the worker on, your laptop would send real notifications to real users.
> Manual sends (`/api/push/test`, `/api/push/announce`) still work with it off —
> only the daily scheduled job is disabled.

## 3. Register a token

Open the app on the phone and sign in. Registration runs automatically after
sign-in. Check the API log for `POST /api/push/token` returning 200, or:

```sql
SELECT Id, ExpoPushToken FROM Users WHERE ExpoPushToken IS NOT NULL;
```

## 4. Send one to yourself

**Settings → Send test notification** (dev builds only, admin accounts only).

- Leave the app **open** → the banner proves the foreground handler works.
- **Background** the app first → proves lock-screen delivery and the deep link.

Or from Postman: `docs/paperai-push.postman_collection.json`, request 5, with
`baseUrl` set to `{{localUrl}}`.

## 5. Test an announcement

```bash
# Opt in first — announcements default to OFF (guideline 4.5.4)
curl -X PUT http://localhost:5263/api/push/preferences \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"announcements":true}'

# Dry run: audience count, delivers nothing
curl -X POST http://localhost:5263/api/push/announce \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"New feature","body":"Sign & Fill is here","dryRun":true}'

# Send
curl -X POST http://localhost:5263/api/push/announce \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"title":"New feature","body":"Sign & Fill is here","screen":"Upload"}'
```

## What "it didn't work" means

The app reports a distinct reason for each failure — it does not just say
"could not get a token":

| Message | Cause | Fix |
|---|---|---|
| Not Available In Expo Go | SDK 53 removed remote push from Expo Go | Development build |
| Needs A Real Device | Simulator | Real iPhone |
| Notifications Are Off | Permission denied | iOS Settings → Notifications |
| Missing Project ID | No `extra.eas.projectId` in app.json | It is set; check the build picked it up |
| Could Not Get A Token | Expo refused | Read `detail` in the alert |
| Server Did Not Accept The Token | API rejected it | **404 = `/api/push` not deployed.** Check `EXPO_PUBLIC_API_BASE_URL` points at your local API |

`{"ok":false,"tokenIsDead":true,"error":"DeviceNotRegistered"}` from the test
endpoint means the stored token is stale — the app was deleted or reinstalled.
It is cleared automatically; sign in again to register a fresh one.

## Before pushing to production

- [ ] Test notification arrives in foreground **and** background
- [ ] Tapping it opens the right document
- [ ] Announce dry-run reports the audience you expect
- [ ] Toggling each switch in Settings sticks after an app restart
- [ ] Announcements is **off** on a fresh account
