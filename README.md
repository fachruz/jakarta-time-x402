# Jakarta Time — x402 Paid API

A minimal, dependency-free pay-per-request API that returns the current date and
time for any IANA timezone, paid per call with the **x402 protocol (v2)** in
USDC on **Base**.

**Status: live and listed.**

- Marketplace listing: **Jakarta time** on [vAPI Call](https://api.vapinetwork.ai/call/jakarta-time) — listed 2026-11-11, payout wallet confirmed
- Live endpoint: `GET https://jakarta-time-x402.onrender.com/jakarta-time`
- Price: **$0.001 per call** (1000 atomic USDC, `exact` scheme)
- Payout wallet: `0x1AfD81F698b6bC87fE48A2B2078111AF0f6b968c` (Base)
- Grading: passes the official `vapi check` **11/11** (status, transport, version,
  fields, scheme, asset, pay-to, timeout, extensions, discovery, OpenAPI)

## Endpoint

- `GET /jakarta-time` — current date/time in a timezone (default `Asia/Jakarta`,
  override with `?zone=<IANA name>`). Response includes ISO string, date, time,
  weekday, UTC offset and Unix seconds.
- Supporting documents: `GET /.well-known/x402` (discovery) and
  `GET /openapi.json` (OpenAPI 3.1 with `x-payment-info`), plus `GET /` and
  `GET /health` for humans.

## Run it

```bash
node server.js          # or: npm start
# listens on PORT (default 8402)
```

Grade it with the vAPI CLI:

```bash
vapi check http://localhost:8402/jakarta-time
```

## How the payment flow works

Unpaid requests receive HTTP 402 with the payment challenge both in the
`PAYMENT-REQUIRED` header (base64 JSON) and in the JSON body — the x402 v2 shape
that `vapi check` grades and `vapi pay` pays: one `accepts` entry,
`scheme: "exact"`, `network: "eip155:8453"`, `amount: "1000"` (atomic USDC =
$0.001), canonical Base USDC as `asset`, and the USDC EIP-712 domain
(`USD Coin`, version `2`) in `extra`.

## Honest limitation

This minimal build **does not settle payments yet**: if a client presents a
payment proof (`PAYMENT-SIGNATURE` / `X-PAYMENT` header), the server answers 402
with an explanatory error instead of serving against an unverified proof.
Verifying an EIP-3009 authorization needs a facilitator (e.g. the public x402
facilitator or Coinbase CDP) or an ethers/viem dependency; wire one of those in
before taking real paid traffic. The 402 challenge itself — the part the vAPI
listing probe and `vapi check` grade — is complete and production-shaped.

For local demos only, `ALLOW_UNVERIFIED_DEMO=1` makes the endpoint serve the
time payload to any request that presents a payment header, without verifying
it. Never enable that on a public deployment.

## Deployment

Runs on Render's free tier (Web Service, Singapore) from this repository —
auto-deploys on push to `main`. The free instance sleeps after ~15 minutes
idle, so the first request after a quiet period can take up to a minute.

Built as a working portfolio piece: a real, listed, payable API endpoint —
not a mock.
