"""
Curated registry of Algorand ecosystem protocols.

Uses a strictly layered "God-tier" JSON prompt structure to prevent LLM hallucinations,
enforce strict constraints, and provide exact multi-layer syntaxes.
"""

import json
from typing import TypedDict, Optional


class Protocol(TypedDict):
    id: str
    name: str
    description: str
    category: str
    icon: str
    integration_prompt: str
    sdk_package: Optional[str]
    docs_url: Optional[str]


def build_structured_prompt(overview: str, contract: str, frontend: str, specific_constraints: list[str], specific_failures: list[str]) -> str:
    """Combines protocol-specific data with global Algorand invariant rules."""
    structure = {
        "overview": overview,
        "contract_pattern": contract,
        "frontend_pattern": frontend,
        "constraints": [
            "GLOBAL: ALWAYS validate sender and receiver matching",
            "GLOBAL: NEVER assume transaction index (e.g. gtxn[0]); always use typed accessor like gtxn.PaymentTxn()",
            "GLOBAL: ALWAYS check Global.groupSize to prevent group transaction spoofing",
            "GLOBAL: DISALLOW rekeyTo — assert rekeyTo is ZeroAddress in all Pay/Asset transfers"
        ] + specific_constraints,
        "common_failures": [
            "Wrong Application ID referenced in foreign arrays",
            "Missing account Opt-in checks before transferring ASAs",
            "Unsafe inner transaction (missing fee bounds or relying on unchecked user inputs)"
        ] + specific_failures
    }
    return json.dumps(structure, indent=2)


PROTOCOLS: list[Protocol] = [
    {
        "id": "tinyman",
        "name": "Tinyman DEX",
        "description": "Automated Market Maker (AMM) DEX on Algorand with liquidity pools, token swaps, and yield farming.",
        "category": "DEX",
        "icon": "arrow-left-right",
        "sdk_package": "@tinymanorg/tinyman-js-sdk",
        "docs_url": "https://docs.tinyman.org/",
        "integration_prompt": build_structured_prompt(
            overview="Integrate Tinyman AMM DEX for token swaps and liquidity provision. Uses atomic transaction groups where the smart contract acts as a verifier of the swap leg.",
            contract="""import { Contract, abimethod, gtxn, Uint64, uint64 } from '@algorandfoundation/algorand-typescript';

export class DEXIntegration extends Contract {
  @abimethod()
  public verifySwapGroup(poolAppId: uint64): void {
    assert(Global.groupSize === Uint64(2), "Must be exact group size");
    const payment = gtxn.PaymentTxn(Uint64(0));
    const swapCall = gtxn.ApplicationCallTxn(Uint64(1));
    
    assert(payment.amount > Uint64(0), "Empty payment");
    assert(swapCall.applicationId === poolAppId, "Invalid pool target");
    assert(payment.rekeyTo === Global.zeroAddress, "No rekeying allowed");
  }
}""",
            frontend="""import { swap, poolUtils } from "@tinymanorg/tinyman-js-sdk";
// Fetch pool, get quote, generate TxGroup, sign with @txnlab/use-wallet-react
const pool = await poolUtils.v2.getPoolInfo({ client, network: "testnet", asset1ID: 0, asset2ID: ASA_ID });
const quote = await swap.v2.getQuote({ type: "fixed-input", assetIn: { id: 0, amount: 5000000 }, pool });
const txGroup = await swap.v2.generateTxns({ client, network: "testnet", swapType: "fixed-input", quote, slippage: 0.05, initiatorAddr: activeAddress });""",
            specific_constraints=[
                "Tinyman Swaps MUST be part of an atomic group.",
                "Contract MUST verify the Tinyman App ID being called in the group."
            ],
            specific_failures=[
                "Slippage set too low causing runtime swap failure.",
                "Tinyman pool does not exist for the pair."
            ]
        ),
    },
    {
        "id": "folks-finance",
        "name": "Folks Finance",
        "description": "Decentralized lending and borrowing protocol on Algorand with variable interest rates.",
        "category": "Lending",
        "icon": "landmark",
        "sdk_package": "folks-finance-js-sdk",
        "docs_url": "https://docs.folks.finance/",
        "integration_prompt": build_structured_prompt(
            overview="Integrate Folks Finance for lending and borrowing ALGO and ASAs.",
            contract="""import { Contract, abimethod, itxn, bytes, Uint64, uint64 } from '@algorandfoundation/algorand-typescript';

export class LendingVault extends Contract {
  @abimethod()
  public depositToFolks(folksAppId: uint64, amount: uint64): void {
     itxn.payment({ receiver: this.app.address, amount: amount, fee: Uint64(0) }).submit();
     itxn.applicationCall({ appId: folksAppId, appArgs: [bytes('deposit')], fee: Uint64(0) }).submit();
  }
}""",
            frontend="""import { LendingPool } from "folks-finance-js-sdk";
const pool = new LendingPool(algodClient, poolAppId);
const depositTxns = await pool.prepareDepositTxns({ amount: 1000000, userAddress: activeAddress });""",
            specific_constraints=[
                "Always inner-call the deposit endpoint immediately after the inner-payment transfer.",
                "Ensure contract balance covers minimum balance requirements before locking funds."
            ],
            specific_failures=[
                "User lacks fToken opt-in before deposit completes.",
                "Borrow requested exceeds collateral health factor."
            ]
        )
    },
    {
        "id": "algorand-asa",
        "name": "Algorand Standard Assets (ASA)",
        "description": "Native Layer-1 standard for creating fungible, non-fungible, and restricted tokens.",
        "category": "Token",
        "icon": "coins",
        "sdk_package": "algosdk",
        "docs_url": "https://developer.algorand.org/docs/get-details/asa/",
        "integration_prompt": build_structured_prompt(
            overview="Integrate Algorand Standard Asset (ASA) minting and transfer natively via Layer-1.",
            contract="""import { Contract, abimethod, itxn, Uint64, uint64, Account } from '@algorandfoundation/algorand-typescript';

export class TokenMinter extends Contract {
  @abimethod()
  public createToken(name: string, unitName: string, totalSupply: uint64): uint64 {
    const assetTxn = itxn.assetConfig({
      total: totalSupply, decimals: 6, assetName: name, unitName: unitName,
      manager: this.app.address, reserve: this.app.address, freeze: this.app.address, clawback: this.app.address,
      fee: Uint64(0)
    }).submit();
    return assetTxn.createdAsset!.id;
  }
  @abimethod()
  public sendToken(assetId: uint64, receiver: Account, amount: uint64): void {
     itxn.assetTransfer({ xferAsset: assetId, assetReceiver: receiver, assetAmount: amount, fee: Uint64(0) }).submit();
  }
}""",
            frontend="""import algosdk from "algosdk";
// User MUST Opt-in to ASA before receiving it
const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    from: activeAddress, to: activeAddress, assetIndex: targetAssetId, amount: 0,
    suggestedParams: await algodClient.getTransactionParams().do()
});""",
            specific_constraints=[
                "Receiver MUST have opted into the ASA before itxn.assetTransfer is called.",
                "Contract MUST be funded to cover the 0.1 ALGO minimum balance increase per created ASA."
            ],
            specific_failures=[
                "AssetTransfer fails due to missing receiver Opt-In.",
                "AssetConfig fails due to insufficient contract minimum balance."
            ]
        )
    },
    {
        "id": "gora-oracle",
        "name": "Gora Network Oracle",
        "description": "Price feed oracle integration providing real-time secure off-chain data to Algorand smart contracts.",
        "category": "Infrastructure",
        "icon": "satellite",
        "sdk_package": "gora-js",
        "docs_url": "https://docs.gora.io/",
        "integration_prompt": build_structured_prompt(
            overview="Integrate Gora price oracle feeds into Algorand smart contracts to fetch real-world data verified by the decentralized oracle network.",
            contract="""import { Contract, abimethod, BoxMap, uint64, Uint64 } from '@algorandfoundation/algorand-typescript';

export class TradingVault extends Contract {
  prices = BoxMap<string, uint64>();

  @abimethod()
  public updatePriceViaOracle(pair: string): void {
    // Oracles push data to boxes or you cross-reference the Oracle App's state.
    this.prices(pair).value = Uint64(1_500_000); // Ex: $1.50 scaled by 1e6
  }
}""",
            frontend="""import { GoraClient } from "gora-js";
const gora = new GoraClient(algodClient);
const feed = await gora.getFeed("ALGO/USD");
const currentPrice = feed.price;""",
            specific_constraints=[
                "Always verify the data timestamp from the Oracle payload.",
                "Never trust unstamped unverified external price pushes."
            ],
            specific_failures=[
                "Stale price attack: Contract did not check if the oracle timestamp was older than 5 minutes.",
                "Unscaled math: Contract used price directly without adjusting for decimal precision."
            ]
        )
    },
]


def get_all_protocols() -> list[Protocol]:
    return PROTOCOLS

def get_protocol_by_id(protocol_id: str) -> Protocol | None:
    for p in PROTOCOLS:
        if p["id"] == protocol_id:
            return p
    return None

def get_protocols_by_category(category: str) -> list[Protocol]:
    return [p for p in PROTOCOLS if p["category"].lower() == category.lower()]

def get_categories() -> list[str]:
    return sorted(set(p["category"] for p in PROTOCOLS))

def get_protocol_summary_for_llm() -> str:
    lines = ["Available Algorand ecosystem protocols:"]
    for p in PROTOCOLS:
        lines.append(f"- {p['name']} ({p['category']}): {p['description']}")
    return "\n".join(lines)
