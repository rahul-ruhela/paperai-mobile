# Dependency & Secrets Audit

Run: 2026-08-29, against `development` in both repos.
Re-run with `npm audit` (mobile) and `dotnet list package --vulnerable --include-transitive` (API).

---

## 1. `npm audit`: 8 high — accepted, not fixed

All eight collapse to a single root cause and **none of them are fixable today**.

| | |
|---|---|
| Advisories | GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq (CVSS 7.5) |
| Package | `image-size` <= 2.0.2 — infinite loop on malformed ICNS / JXL / HEIF |
| Path | `expo` → `@expo/metro` → `metro` → `image-size@1.2.1` |
| Reported as | 8 separate highs: `expo`, `@expo/cli`, `@expo/metro`, `@expo/metro-config`, `metro`, `metro-config`, `metro-transform-worker`, `image-size` |

### Why it is accepted

**It is not in the shipped app.** `metro` and `@expo/cli` are bundler tooling.
They appear in neither `dependencies` nor `devDependencies`, they are not part of
the iOS binary, and no user ever executes them. Exploiting this requires placing
a malicious ICNS/JXL/HEIF file into this project's own assets, and the result is
that a build hangs on the developer's machine. There is no user-facing exposure
and nothing here that App Review inspects.

**No patched version exists.** `npm view image-size@'>2.0.2'` returns nothing —
there is no fixed release on any channel. `metro@latest` (0.87.0) still declares
`image-size: ^1.0.2`. An `overrides` entry therefore has nothing to point at.

**npm's suggested fix is a false fix.** `npm audit fix --force` resolves to
`expo@57` — SDK 54 → 57, three majors. That forces a new native build, is very
likely to break it, and still ships the same vulnerable `image-size`. It would
leave the security posture identical and the build broken.

### When to revisit

At the next deliberate Expo SDK upgrade, planned as its own piece of work — not
as a security fix, because it is not one. Re-run `npm audit` then; if a patched
`image-size` has shipped by that point, the transitive bump comes along for free.

---

## 2. NuGet: clean

`dotnet list package --vulnerable --include-transitive` reports **no vulnerable
packages** for `PaperAi.csproj` or `tests/PaperAiApis.Tests`.

One deprecation, not a vulnerability: `itext7` 9.4.0 is superseded by the
renamed `itext` package. A rename, no advisory, no urgency.

---

## 3. Secrets: remediated in the API repo, with rotation still outstanding

`appsettings.json` and `appsettings.Development.json` were **tracked in git** and
held live, working credentials: the production SQL connection string and
password, `Jwt:Key` (which signs every auth token), an OpenAI API key, Twilio
SID and token, the Apple App Store Server API P8 private key, and the Redis
password.

Blast radius was limited by two facts, both verified: the API repo is
**private**, and this mobile repo — which is **public** — contains no secrets in
any tracked file.

**Done** (API repo, commit `1601199`): both files untracked and gitignored, with
`appsettings.Example.json` / `appsettings.Development.Example.json` committed in
their place — same structure, comments and IAP catalogue, every credential
blanked. Local files were left on disk, so nothing at runtime changed:
`appsettings.Local.json` is loaded last and already carried every one of these
values, which is what made the tracked copies redundant.

**Still outstanding — manual, and deliberately not automated:**

1. The credentials remain **valid** and remain in **git history**. Untracking
   stops future exposure; it does not undo past exposure.
2. Rotation order, most to least urgent:
   - `Jwt:Key` — anyone holding it can forge a token for any user. Rotating it
     signs out every user, so plan the moment.
   - Apple P8 (App Store Connect → Keys) and the OpenAI key — both billable.
   - SQL password — the server is on a public IP with 1433 open.
   - Twilio token, Redis password.
3. Update `appsettings.Local.json` locally **and on the VPS** as each is rotated.

### Deployment note

If the VPS deploys by `git pull`, the next pull removes `appsettings.json` from
its working tree, because it is no longer tracked. Confirm the VPS has a
populated `appsettings.Local.json` — or back the file up there — **before**
pulling this commit.
