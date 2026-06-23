# API Integration Reference

## Backend

- **Framework:** .NET 8 / ASP.NET Core
- **Base URL (production):** `https://apis.bseptechnologies.com`
- **Auth:** JWT Bearer tokens (access + refresh rotation)
- **Health check:** `GET /health` → `{ status: "Healthy" | "Degraded" | "Unhealthy" }`

---

## Auth Endpoints

| Method | Route | Body | Returns |
|--------|-------|------|---------|
| POST | `/api/auth/register` | `{ name, email, password, phone? }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/email-otp/send` | `{ email }` | `{ message }` |
| POST | `/api/auth/email-otp/verify` | `{ email, code, name?, password?, phone? }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/otp/send` | `{ phone }` | `{ message }` |
| POST | `/api/auth/otp/verify` | `{ phone, otp }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/apple` | `{ identityToken, email?, name? }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/logout` | `{ refreshToken }` | `{ message }` |

---

## Billing / Subscription Endpoints

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/api/billing/entitlement` | ✅ Required | Returns `{ active, productId, status, expiresAtUtc }` |
| POST | `/api/billing/ios/verify-transaction-auto` | ✅ Required | **Primary endpoint.** Auto-detects sandbox vs production. Body: `{ transactionId }` |
| POST | `/api/billing/ios/sync-receipt` | ✅ Required | Legacy StoreKit 1 receipt sync. Body: `{ receiptDataBase64 }` |
| POST | `/api/billing/ios/verify-receipt` | ✅ Required | Legacy receipt verification. Body: `{ receiptDataBase64 }` |
| POST | `/api/billing/ios/verify-transaction` | ✅ Required | StoreKit 2 with explicit sandbox flag. Body: `{ transactionId, sandbox }` |
| POST | `/api/billing/mock-subscribe` | ✅ Required | **Dev only** — blocked in production. Body: `{ productId }` |
| POST | `/api/billing/ios/notifications-v2` | ❌ Public | Apple Server Notifications webhook. Body: `{ signedPayload }` |

### Entitlement response shape
```json
{
  "active": true,
  "productId": "com.bholeshankar.paperai.pro_monthly",
  "status": "active",
  "expiresAtUtc": "2026-07-24T00:00:00Z"
}
```

### Product IDs (must match App Store Connect)
| Plan | Product ID | Credits/cycle |
|------|-----------|---------------|
| Weekly | `com.bholeshankar.paperai.pro_weekly` | 30 |
| Monthly | `com.bholeshankar.paperai.pro_monthly` | 152 |
| Yearly | `com.bholeshankar.paperai.pro_yearly` | 2184 |

---

## Documents Endpoints

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/api/documents` | ✅ | List all documents for user |
| POST | `/api/documents/{id}/process` | ✅ | Trigger AI processing |
| DELETE | `/api/documents/{id}` | ✅ | Soft-delete a document |

---

## Backend Configuration Requirements

### `appsettings.Production.json` (already configured)
```json
{
  "IAP": { "Enabled": true, "AllowSandbox": false },
  "DevMode": { "BypassSubscription": false }
}
```

### `appsettings.Development.json` / `appsettings.json` (local dev)
```json
{
  "IAP": { "Enabled": true, "AllowSandbox": true },
  "DevMode": { "BypassSubscription": true }
}
```

### Apple Server Notifications webhook
Register this URL in App Store Connect → App Information → App Store Server Notifications:
```
https://apis.bseptechnologies.com/api/billing/ios/notifications-v2
```

---

## Error Response Format

All API errors return:
```json
{ "message": "Human-readable error", "error": "machine_code" }
```
or plain string for simple cases. The frontend `client.js` maps HTTP status codes to friendly messages automatically via `err.userMessage`.

---

## Standard HTTP Status Codes

| Code | Meaning | Frontend behavior |
|------|---------|-------------------|
| 200 | OK | Continue |
| 400 | Bad request / validation | Show `message` field |
| 401 | Unauthorized | Auto-refresh token; if fails → logout |
| 403 | Forbidden | "You don't have permission" |
| 404 | Not found | "Not found" |
| 409 | Conflict | Show `message` field |
| 422 | Unprocessable | Show validation error |
| 429 | Rate limited | "Please wait a moment" |
| 500+ | Server error | "Our servers are having issues" |

---

## TODO: Missing backend features

- [ ] `GET /api/profile` — currently used by ProfileScreen, confirm shape matches frontend
- [ ] `POST /api/profile` — profile update endpoint
- [ ] Webhook signature verification on `/api/billing/ios/notifications-v2` (currently trusts Apple JWS payload only)
- [ ] Add `X-Request-ID` header to all responses for support tracing
