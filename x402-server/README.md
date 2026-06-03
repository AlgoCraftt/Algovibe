# AlgoVibe x402 Demo Server

Spec-compliant x402 resource server on Algorand TestNet.

Based on the [Algorand Foundation x402 demo](https://github.com/algorandfoundation/x402-demo) and
the [x402 on Algorand tutorial](https://dev.algorand.co/resources/x402-on-algorand/).

## What This Does

When a client hits `GET /api/data`:
1. Server returns **HTTP 402 Payment Required** + payment instructions (price, network, payTo)
2. Client signs a USDC payment on Algorand TestNet
3. Client retries with `X-PAYMENT` header containing the signed proof
4. Facilitator (`facilitator.goplausible.xyz`) verifies on-chain
5. Server returns the actual API response

No API keys. No sessions. Payment is the authentication.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure
cp .env.template .env
# Edit .env — set AVM_ADDRESS to your Algorand TestNet address

# 3. Run
pnpm start
```

## Test

```bash
# Should return 402 Payment Required
curl http://localhost:4021/api/data

# Health check (free, no payment needed)
curl http://localhost:4021/health
```

## Prerequisites

- Node.js LTS or newer with pnpm
- Algorand TestNet account with USDC (for receiving payments)
- On first run, you may need: `pnpm approve-builds`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AVM_ADDRESS` | Yes | Your Algorand address that receives payments |
| `FACILITATOR_URL` | No | Default: `https://facilitator.goplausible.xyz` |
| `PORT` | No | Default: `4021` |

## How AlgoVibe Uses This

The AlgoVibe preview connects to this server when you configure an x402 endpoint URL.
The preview's bridge signs x402 payments using the connected wallet, enabling a real
end-to-end 402 → pay → verify → serve flow.

## Architecture

```
AlgoVibe Preview          This Server              Facilitator (goplausible)
     │                       │                          │
     │── GET /api/data ─────▶│                          │
     │◀── 402 + pay $0.01 ──│                          │
     │                       │                          │
     │── sign USDC payment ──│                          │
     │                       │                          │
     │── GET + X-PAYMENT ───▶│── verify proof ────────▶ │
     │                       │◀── confirmed ───────────│
     │◀── API response ─────│                          │
```

## Learn More

- [x402 Protocol](https://x402.org/)
- [x402 on Algorand (Dev Portal)](https://dev.algorand.co/resources/x402-on-algorand/)
- [Algorand Foundation x402 Demo](https://github.com/algorandfoundation/x402-demo)
- [@x402 on npm](https://www.npmjs.com/search?q=%40x402)
