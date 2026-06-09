"""
x402 Proxy Endpoint — performs the full x402 round trip on behalf of the preview.

The Sandpack iframe cannot directly reach a localhost x402 server (CORS/Private Network Access).
The frontend also cannot use @x402/fetch (it requires a private key signer).

This endpoint:
  1. Receives the x402 server URL from the frontend
  2. Uses @x402/fetch + a funded hot wallet (X402_MNEMONIC) to do the real payment
  3. Returns the server's response to the frontend

The hot wallet is a funded TestNet account used solely for x402 demo payments.
"""

import asyncio
import subprocess
import json
import logging
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class X402ProxyRequest(BaseModel):
    """Request to proxy an x402 paid fetch."""
    url: str  # The x402 server paid endpoint (e.g. http://localhost:4021/api/data)
    method: str = "GET"


class X402ProxyResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    receipt: Optional[dict] = None
    error: Optional[str] = None
    mode: str = "x402-http"


# Inline Node.js script that uses @x402/fetch to do the real round trip.
# This runs as a subprocess so we don't need @x402 installed in Python.
X402_CLIENT_SCRIPT = """
import { config } from 'dotenv';
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from '@x402/fetch';
import { toClientAvmSigner, ExactAvmScheme, ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import algosdk from 'algosdk';

config();

const mnemonic = process.env.X402_MNEMONIC;
const url = process.env.X402_TARGET_URL;
const method = process.env.X402_METHOD || 'GET';

if (!mnemonic || !url) {
  console.log(JSON.stringify({ success: false, error: 'Missing X402_MNEMONIC or X402_TARGET_URL' }));
  process.exit(0);
}

async function main() {
  try {
    // algosdk secret key = 64 bytes (32-byte seed + 32-byte pubkey) — the format @x402/avm wants
    const account = algosdk.mnemonicToSecretKey(mnemonic);
    const secretKey = Buffer.from(account.sk).toString('base64');

    const avmSigner = toClientAvmSigner(secretKey);
    const client = new x402Client();
    client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(avmSigner));

    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const response = await fetchWithPayment(url, { method });

    if (response.ok) {
      const paymentResponse = new x402HTTPClient(client).getPaymentSettleResponse(name => response.headers.get(name));
      const body = await response.json();
      console.log(JSON.stringify({
        success: true,
        data: body,
        receipt: paymentResponse || { protocol: 'x402', status: 'settled' },
      }));
    } else {
      const text = await response.text().catch(() => '');
      console.log(JSON.stringify({
        success: false,
        error: `Server returned ${response.status}: ${text.slice(0, 300)}`,
      }));
    }
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message || String(err),
    }));
  }
}

main();
"""


@router.post("/x402-proxy", response_model=X402ProxyResponse)
async def x402_proxy(request: X402ProxyRequest) -> X402ProxyResponse:
    """
    Proxy an x402 paid fetch using the platform hot wallet.
    
    Uses the @x402/fetch client library (Node.js) with a funded TestNet mnemonic
    to perform the real x402 payment flow: fetch → 402 → sign → retry → response.
    """
    mnemonic = getattr(settings, 'x402_mnemonic', '') or os.environ.get('X402_MNEMONIC', '')
    if not mnemonic:
        raise HTTPException(
            status_code=500,
            detail="X402_MNEMONIC not configured. Set it in .env to a funded TestNet account mnemonic."
        )

    if not request.url:
        raise HTTPException(status_code=400, detail="url is required")

    # Write the script to a temp file and execute with tsx
    script_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'x402-server')
    script_dir = os.path.abspath(script_dir)

    # Check if x402-server/node_modules exists (dependencies installed)
    if not os.path.isdir(os.path.join(script_dir, 'node_modules')):
        return X402ProxyResponse(
            success=False,
            error="x402-server dependencies not installed. Run: cd x402-server && pnpm install",
            mode="error",
        )

    # Write temp script with a unique name to avoid races between concurrent requests
    import uuid
    script_path = os.path.join(script_dir, f'_x402_run_{uuid.uuid4().hex[:8]}.ts')
    try:
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(X402_CLIENT_SCRIPT)

        env = {
            **os.environ,
            'X402_MNEMONIC': mnemonic,
            'X402_TARGET_URL': request.url,
            'X402_METHOD': request.method,
        }

        # Use the local tsx binary directly from node_modules/.bin (avoids npx resolution issues)
        bin_dir = os.path.join(script_dir, 'node_modules', '.bin')
        if os.name == 'nt':
            tsx_bin = os.path.join(bin_dir, 'tsx.cmd')
        else:
            tsx_bin = os.path.join(bin_dir, 'tsx')

        if not os.path.isfile(tsx_bin):
            return X402ProxyResponse(
                success=False,
                error=f"tsx not found at {tsx_bin}. Run: cd x402-server && pnpm install",
                mode="error",
            )

        # Run the x402 client script
        try:
            result = await asyncio.to_thread(
                subprocess.run,
                [tsx_bin, script_path],
                capture_output=True,
                text=True,
                cwd=script_dir,
                env=env,
                timeout=60,
                shell=False,
            )
        except subprocess.TimeoutExpired:
            return X402ProxyResponse(
                success=False,
                error="x402 payment timed out after 60 seconds. Is the x402 server running?",
                mode="error",
            )

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if stderr and not stdout:
            logger.warning(f"[x402-proxy] stderr: {stderr[:500]}")

        if not stdout:
            return X402ProxyResponse(
                success=False,
                error=f"x402 client produced no output. stderr: {stderr[:300]}",
                mode="error",
            )

        # Parse JSON output from the script
        try:
            data = json.loads(stdout)
        except json.JSONDecodeError:
            # Sometimes tsx prints warnings before JSON
            lines = stdout.split('\n')
            for line in reversed(lines):
                try:
                    data = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue
            else:
                return X402ProxyResponse(
                    success=False,
                    error=f"Failed to parse x402 client output: {stdout[:300]}",
                    mode="error",
                )

        if data.get('success'):
            return X402ProxyResponse(
                success=True,
                data=data.get('data'),
                receipt=data.get('receipt'),
                mode="x402-http",
            )
        else:
            return X402ProxyResponse(
                success=False,
                error=data.get('error', 'Unknown x402 client error'),
                mode="error",
            )

    finally:
        # Clean up temp script
        try:
            os.remove(script_path)
        except OSError:
            pass
