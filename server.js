#!/usr/bin/env node
// Minimal dependency-free x402 (v2) paid API — one endpoint: current time in a timezone.
// Unpaid requests get a standards-shaped HTTP 402 challenge; see README.md.
'use strict';

const http = require('node:http');

// --- Payment configuration (Base mainnet USDC, x402 "exact" scheme) ---
const PAY_TO = '0x1AfD81F698b6bC87fE48A2B2078111AF0f6b968c'; // agent wallet (Base)
const NETWORK = 'eip155:8453'; // Base mainnet (CAIP-2)
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // canonical USDC on Base
const AMOUNT_ATOMIC = '1000'; // $0.001 (USDC has 6 decimals)
const MAX_TIMEOUT_SECONDS = 300;
const PORT = Number(process.env.PORT || 8402);
const ENDPOINT_PATH = '/jakarta-time';

function publicBase(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function challenge(req) {
  const resourceUrl = `${publicBase(req)}${ENDPOINT_PATH}`;
  return {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url: resourceUrl,
      description:
        'Current date and time in a timezone (default Asia/Jakarta): ISO string, date, time, weekday and UTC offset. Optional query param: ?zone=<IANA timezone>.',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: NETWORK,
        amount: AMOUNT_ATOMIC,
        asset: ASSET,
        payTo: PAY_TO,
        maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
        extra: {
          // EIP-712 domain of canonical USDC on Base — required for a valid exact offer.
          name: 'USD Coin',
          version: '2',
        },
      },
    ],
    extensions: {
      bazaar: {
        info: {
          input: {
            type: 'http',
            method: 'GET',
            queryParams: {
              zone: 'Optional IANA timezone name, e.g. Asia/Jakarta (default), Asia/Singapore, Europe/London, UTC.',
            },
          },
          output: {
            type: 'json',
            example: {
              zone: 'Asia/Jakarta',
              iso: '2026-11-11T19:09:47+07:00',
              date: '2026-11-11',
              time: '19:09:47',
              weekday: 'Wednesday',
              utcOffset: '+07:00',
              unixSeconds: 1794400187,
            },
          },
        },
        schema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: {
            input: {
              type: 'object',
              properties: { zone: { type: 'string' } },
              additionalProperties: false,
            },
            output: {
              type: 'object',
              properties: {
                zone: { type: 'string' },
                iso: { type: 'string' },
                date: { type: 'string' },
                time: { type: 'string' },
                weekday: { type: 'string' },
                utcOffset: { type: 'string' },
                unixSeconds: { type: 'number' },
              },
              required: ['zone', 'iso', 'date', 'time', 'weekday', 'utcOffset', 'unixSeconds'],
            },
          },
        },
      },
    },
  };
}

function sendJson(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function jakartaTimePayload(zone) {
  const now = new Date();
  const fmt = (options) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options });
  const parts = Object.fromEntries(
    fmt({
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const weekday = fmt({ weekday: 'long' }).format(now);
  // UTC offset for the zone, e.g. +07:00, derived from the zone's wall clock vs UTC.
  const tzName = fmt({ timeZoneName: 'longOffset' }).formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value || 'GMT+07:00';
  const offset = tzName.replace('GMT', '') || '+00:00';
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
  return {
    zone,
    iso,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    weekday,
    utcOffset: offset,
    unixSeconds: Math.floor(now.getTime() / 1000),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, publicBase(req));

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendJson(res, 200, {
      name: 'jakarta-time-x402',
      description: 'Pay-per-request current-time API (x402 v2, Base USDC).',
      paidEndpoint: ENDPOINT_PATH,
      price: '$0.001 per call in USDC on Base',
      payTo: PAY_TO,
      discovery: '/.well-known/x402',
      openapi: '/openapi.json',
    });
  }

  if (req.method === 'GET' && url.pathname === '/.well-known/x402') {
    return sendJson(res, 200, {
      x402Version: 2,
      resources: [`${publicBase(req)}${ENDPOINT_PATH}`],
    });
  }

  if (req.method === 'GET' && url.pathname === '/openapi.json') {
    return sendJson(res, 200, {
      openapi: '3.1.0',
      info: {
        title: 'Jakarta Time (x402)',
        version: '1.0.0',
        description: 'Current date/time in a timezone, paid per request with x402 (Base USDC).',
      },
      servers: [{ url: publicBase(req) }],
      paths: {
        [ENDPOINT_PATH]: {
          get: {
            operationId: 'getTime',
            summary: 'Current date and time in a timezone (default Asia/Jakarta)',
            parameters: [
              {
                name: 'zone',
                in: 'query',
                required: false,
                schema: { type: 'string', default: 'Asia/Jakarta' },
                description: 'IANA timezone name.',
              },
            ],
            'x-payment-info': {
              scheme: 'exact',
              network: NETWORK,
              amount: AMOUNT_ATOMIC,
              asset: ASSET,
              payTo: PAY_TO,
              maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
              price: '$0.001',
            },
            responses: {
              '200': { description: 'Current time payload.' },
              '402': { description: 'Payment required (x402 challenge).' },
            },
          },
        },
      },
    });
  }

  if (req.method === 'GET' && url.pathname === ENDPOINT_PATH) {
    const paymentSignature = req.headers['payment-signature'] || req.headers['x-payment'];
    if (!paymentSignature) {
      const offer = challenge(req);
      const header = Buffer.from(JSON.stringify(offer)).toString('base64');
      return sendJson(res, 402, offer, { 'payment-required': header });
    }
    // A payment proof was presented. This minimal build has no facilitator wired up to
    // verify/settle it, so refuse honestly instead of serving against an unverified proof.
    // Local demo escape hatch (never enable on a public deployment):
    if (process.env.ALLOW_UNVERIFIED_DEMO === '1') {
      const zone = url.searchParams.get('zone') || 'Asia/Jakarta';
      try {
        return sendJson(res, 200, jakartaTimePayload(zone));
      } catch {
        return sendJson(res, 400, { error: 'invalid_zone', zone });
      }
    }
    return sendJson(res, 402, {
      ...challenge(req),
      error:
        'Payment settlement is not configured on this deployment yet (no facilitator); the presented proof was not accepted or charged by this server.',
    });
  }

  return sendJson(res, 404, { error: 'not_found', path: url.pathname });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`jakarta-time-x402 listening on http://0.0.0.0:${PORT}${ENDPOINT_PATH}`);
});
