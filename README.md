# Jakarta Time — minimal x402 paid API

One pay-per-request endpoint, no dependencies (plain Node.js ≥ 18):

- `GET /jakarta-time` — current date/time in a timezone (default `Asia/Jakarta`,
  override with `?zone=<IANA name>`). Costs **$0.001 per call**, paid in USDC on
  Base via the x402 protocol (`exact` scheme, x402Version 2).
- Payments go to the vAPI agent wallet `0x7Bba079ECBE45C957b290C631b33315C850EdfFf` on Base.
- Supporting documents: `GET /.well-known/x402` (discovery) and `GET /openapi.json`
  (OpenAPI 3.1 with `x-payment-info`), plus `GET /` and `GET /health` for humans.

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

## Deploying

Needs any host that runs a plain Node HTTP server and gives a public HTTPS URL
(the URL is what `vapi publish <url>` would later be pointed at — not done yet).
See the deployment shortlist in the task report; nothing is published or listed.
