/**
 * AlgoVibe x402 Demo Server
 * 
 * Based on: https://github.com/algorandfoundation/x402-demo/tree/main/x402-basic-tutorial/server
 * Docs:     https://dev.algorand.co/resources/x402-on-algorand/
 * 
 * This is a REAL, spec-compliant x402 resource server on Algorand TestNet.
 * It uses Hono + @x402/hono middleware to:
 *   1. Return HTTP 402 Payment Required with payment instructions
 *   2. Verify payment proof via the goplausible facilitator
 *   3. Serve content only after payment is confirmed on-chain
 * 
 * Setup:
 *   1. cp .env.template .env
 *   2. Set AVM_ADDRESS to your Algorand TestNet address
 *   3. pnpm install
 *   4. pnpm start
 * 
 * Test:
 *   curl http://localhost:4021/api/data
 *   → 402 Payment Required (PAYMENT-REQUIRED header contains payment instructions)
 * 
 * x402 version: 2.11.0
 * Network: Algorand TestNet
 * Payment: USDC (ASA) via goplausible facilitator
 */

import { config } from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { paymentMiddleware } from '@x402/hono';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm';

config();

// ─── Configuration ────────────────────────────────────────────────────────────
const avmAddress = process.env.AVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL || 'https://facilitator.goplausible.xyz';
const port = parseInt(process.env.PORT || '4021');

if (!avmAddress) {
  console.error('\n  ERROR: Set AVM_ADDRESS in .env to your Algorand TestNet address\n');
  console.error('  Steps:');
  console.error('    1. cp .env.template .env');
  console.error('    2. Set AVM_ADDRESS=YOUR_58_CHAR_ALGO_ADDRESS\n');
  process.exit(1);
}

// ─── x402 Setup ───────────────────────────────────────────────────────────────
// The facilitator verifies payment proofs on-chain (you don't run this yourself)
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Resource server handles the 402 → verify → serve lifecycle
const resourceServer = new x402ResourceServer(facilitatorClient);

// Register the Algorand TestNet "exact" payment scheme
const avmScheme = new ExactAvmScheme();
resourceServer.register(ALGORAND_TESTNET_CAIP2, avmScheme);

// ─── Hono App ─────────────────────────────────────────────────────────────────
const app = new Hono();

// CORS — required for the AlgoVibe preview iframe to call this server
app.use('*', cors({
  origin: '*',
  exposeHeaders: ['X-PAYMENT-RESPONSE', 'PAYMENT-REQUIRED'],
}));

// ─── Payment-Protected Routes ─────────────────────────────────────────────────
// The middleware automatically returns 402 + payment instructions for unpaid requests.
// After the client pays (via X-PAYMENT header), the facilitator verifies on-chain,
// and the request proceeds to your handler below.
app.use(
  paymentMiddleware(
    {
      'GET /api/data': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.01',
            network: ALGORAND_TESTNET_CAIP2,
            payTo: avmAddress,
          },
        ],
        description: 'Premium API data — $0.01 USDC per call via x402',
      },
    },
    resourceServer,
  ),
);

// ─── API Endpoints ────────────────────────────────────────────────────────────

// Paid endpoint — ONLY reachable after x402 payment is verified by the facilitator
app.get('/api/data', (c) => {
  return c.json({
    success: true,
    data: {
      message: 'Payment verified via x402 — here is your premium content',
      timestamp: new Date().toISOString(),
      value: Math.floor(Math.random() * 1000),
      unit: 'credits',
    },
    meta: {
      protocol: 'x402',
      version: '2.11.0',
      network: 'Algorand TestNet',
      price: '$0.01 USDC',
      facilitator: facilitatorUrl,
    },
  });
});

// Free endpoints (not in payment routes config = not payment-gated)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    protocol: 'x402',
    version: '2.11.0',
    network: 'algorand-testnet',
    payTo: avmAddress,
    facilitator: facilitatorUrl,
  });
});

app.get('/', (c) => {
  return c.json({
    name: 'AlgoVibe x402 Demo Server',
    description: 'Spec-compliant x402 resource server on Algorand TestNet',
    protocol: 'x402',
    version: '2.11.0',
    endpoints: {
      paid: 'GET /api/data ($0.01 USDC per call)',
      free: ['GET /health', 'GET /'],
    },
    payTo: avmAddress,
    facilitator: facilitatorUrl,
    docs: 'https://dev.algorand.co/resources/x402-on-algorand/',
    source: 'https://github.com/algorandfoundation/x402-demo',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port }, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │  AlgoVibe x402 Server (Algorand TestNet)         │');
  console.log('  ├─────────────────────────────────────────────────┤');
  console.log(`  │  URL:         http://localhost:${port}             │`);
  console.log('  │  Paid API:    GET /api/data ($0.01 USDC)       │');
  console.log(`  │  Pay-to:      ${avmAddress.slice(0, 12)}...               │`);
  console.log(`  │  Facilitator: ${facilitatorUrl}  │`);
  console.log('  │  Network:     Algorand TestNet (CAIP-2)          │');
  console.log('  │  Asset:       USDC (TestNet ASA 10458941)       │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('');
  console.log('  Test:');
  console.log(`    curl http://localhost:${port}/api/data`);
  console.log('    → 402 Payment Required');
  console.log('');
  console.log('  Docs: https://dev.algorand.co/resources/x402-on-algorand/');
  console.log('');
});
