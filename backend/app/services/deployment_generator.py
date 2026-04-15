"""
Algorand Deployment Code Generator

Generates React/JS code that deploys using the user's wallet.
"""

class DeploymentGenerator:
    """Generates frontend deployment code from ARC32 spec."""

    def generate_deployment_code(
        self,
        arc32_spec: dict,
        approval_teal: str,
        clear_teal: str,
        network: str = "testnet",
    ) -> str:
        """Generate React deployment code."""
        
        # Simplified: We'll create a code block that the frontend can execute
        # In a real app, this would be more complex and use templates.
        
        num_global_ints = arc32_spec.get("state", {}).get("global", {}).get("num_uints", 0)
        num_global_bytes = arc32_spec.get("state", {}).get("global", {}).get("num_byte_slices", 0)
        num_local_ints = arc32_spec.get("state", {}).get("local", {}).get("num_uints", 0)
        num_local_bytes = arc32_spec.get("state", {}).get("local", {}).get("num_byte_slices", 0)

        js_code = f"""
import algosdk from 'algosdk';

export async function deployContract(algodClient, signer, senderAddress) {{
  const approvalTeal = `{approval_teal}`;
  const clearTeal = `{clear_teal}`;

  // Compile programs
  const approvalResult = await algodClient.compile(approvalTeal).do();
  const clearResult = await algodClient.compile(clearTeal).do();

  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeApplicationCreateTxnFromObject({{
    from: senderAddress,
    approvalProgram: new Uint8Array(Buffer.from(approvalResult.result, 'base64')),
    clearProgram: new Uint8Array(Buffer.from(clearResult.result, 'base64')),
    numGlobalInts: {num_global_ints},
    numGlobalByteSlices: {num_global_bytes},
    numLocalInts: {num_local_ints},
    numLocalByteSlices: {num_local_bytes},
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
  }});

  const signedTxn = await signer([txn], [0]);
  const {{ txId }} = await algodClient.sendRawTransaction(signedTxn).do();
  const result = await algosdk.waitForConfirmation(algodClient, txId, 4);

  return {{
    appId: result['application-index'],
    txId
  }};
}}
"""
        return js_code
