"""
RAG Retriever - Query ChromaDB for relevant Algorand documentation

Retrieves relevant documentation chunks to provide context for code generation.
Uses ChromaDB vector search with framework-specific collection routing,
supplemented with curated fallback docs for each supported framework.

Supported frameworks:
- puyapy:      Algorand Python (primary)
- puyats:      Algorand TypeScript (primary)
- tealscript:  TealScript (legacy/migration only)
"""

import chromadb
import logging
from chromadb.config import Settings as ChromaSettings
from typing import Optional
from pathlib import Path

from app.core.config import settings
from app.rag.embeddings import get_embedding

logger = logging.getLogger(__name__)


# ── Framework-to-collection mapping ─────────────────────────────────────
COLLECTION_MAP = {
    "puyapy": ["algorand-puyapy", "algorand-core", "algorand-skills"],
    "puyats": ["algorand-puyats", "algorand-core", "algorand-skills"],
    "tealscript": ["algorand-tealscript", "algorand-core"],
}

# Global ChromaDB client
_chroma_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Get or create ChromaDB client"""
    global _chroma_client

    if _chroma_client is None:
        persist_dir = Path(settings.chroma_persist_dir)
        persist_dir.mkdir(parents=True, exist_ok=True)

        _chroma_client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    return _chroma_client


def _query_collection(
    collection_name: str,
    query_embedding: list[float],
    top_k: int = 3,
) -> list[str]:
    """Query a single ChromaDB collection and return documents."""
    try:
        client = get_chroma_client()
        collection = client.get_collection(collection_name)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas"],
        )
        return results.get("documents", [[]])[0]
    except Exception as e:
        logger.debug(f"Collection {collection_name} query failed: {e}")
        return []


async def retrieve_docs(
    query: str,
    framework: str,           # "puyapy" | "puyats" | "tealscript"
    doc_type: str = None,     # DEPRECATED: kept for backward compat
    top_k: int = None,
) -> list[str]:
    """
    Retrieve relevant Algorand documentation for the given framework.

    Queries framework-specific collections + always queries SDK docs
    for transaction/wallet patterns.

    Args:
        query: Search query (user prompt or specific question)
        framework: Target framework ("puyapy", "puyats", "tealscript")
        doc_type: DEPRECATED — use framework instead
        top_k: Number of results to return (default from settings)

    Returns:
        List of relevant document chunks
    """
    top_k = top_k or settings.rag_top_k

    # Start with fallback docs for guaranteed quality
    base_docs = get_fallback_docs(framework)

    try:
        # Get query embedding
        query_embedding = await get_embedding(query)
        if not query_embedding:
            return base_docs

        # Get framework-specific collections to query
        collections = COLLECTION_MAP.get(framework, ["algorand-core"])
        results = []

        # Query framework-specific + core collections
        per_collection_k = max(2, top_k // len(collections) + 1)
        for col_name in collections:
            docs = _query_collection(col_name, query_embedding, top_k=per_collection_k)
            results.extend(docs)

        # Always query SDK docs for transaction/wallet patterns
        sdk_docs = _query_collection("algorand-sdk", query_embedding, top_k=2)
        results.extend(sdk_docs)

        if results:
            # Filter out irrelevant docs
            irrelevant_keywords = [
                "iOS", "Android", "mobile app", "iPhone", "iPad",
                "Kotlin", "Java", "Swift", "flutter", "react native",
                "Solidity", "Ethereum", "ethers.js",
                "PyTEAL", "Beaker",  # Deprecated — never include
            ]

            filtered_docs = []
            for doc in results:
                is_irrelevant = any(kw.lower() in doc.lower() for kw in irrelevant_keywords)
                is_duplicate = any(doc[:100] in base_doc for base_doc in base_docs)

                if not is_irrelevant and not is_duplicate:
                    filtered_docs.append(doc)

            # Combine: fallback docs first (guaranteed quality), then filtered RAG docs
            return base_docs + filtered_docs[:top_k]

        return base_docs

    except Exception as e:
        logger.error(f"RAG retrieval error: {e}")
        return base_docs


def get_fallback_docs(framework: str) -> list[str]:
    """
    Return fallback documentation when RAG is unavailable.
    These are essential snippets that should always be available.
    """
    if framework == "puyapy":
        return PUYAPY_FALLBACK_DOCS
    elif framework == "puyats":
        return PUYATS_FALLBACK_DOCS
    elif framework == "tealscript":
        return TEALSCRIPT_FALLBACK_DOCS
    else:
        return PUYATS_FALLBACK_DOCS  # default to PuyaTs per Algorand best practices


# ── Fallback Documentation ──────────────────────────────────────────────

PUYAPY_FALLBACK_DOCS = [
    """
# Algorand Python (PuyaPy) Contract Structure

Every Algorand Python smart contract follows this structure:

```python
from algopy import ARC4Contract, arc4, GlobalState, UInt64, String, Bytes, Txn, Global

class MyContract(ARC4Contract):
    \"\"\"My Algorand smart contract.\"\"\"

    # Global state declarations
    counter: GlobalState[UInt64]
    owner: GlobalState[arc4.Address]

    @arc4.abimethod(create="require")
    def create(self) -> None:
        \"\"\"Called on contract creation.\"\"\"
        self.counter = GlobalState(UInt64(0))
        self.owner = GlobalState(arc4.Address(Txn.sender))

    @arc4.abimethod()
    def increment(self) -> arc4.UInt64:
        \"\"\"Increment the counter.\"\"\"
        self.counter.value += UInt64(1)
        return arc4.UInt64(self.counter.value)

    @arc4.abimethod(readonly=True)
    def get_count(self) -> arc4.UInt64:
        \"\"\"Read the current count.\"\"\"
        return arc4.UInt64(self.counter.value)
```

Key rules:
- NEVER use PyTEAL or Beaker — they are legacy and deprecated
- Extend ARC4Contract for ABI compliance
- Use @arc4.abimethod decorator for public methods
- Use GlobalState[] and LocalState[] for typed state
- Use arc4 types (arc4.UInt64, arc4.String, arc4.Bool, arc4.Address)
- Use UInt64 from algopy, not Python int, for on-chain math
""",
    """
# PuyaPy State Management & Box Storage

## Global State
```python
from algopy import GlobalState, UInt64, Bytes

class MyContract(ARC4Contract):
    counter: GlobalState[UInt64]
    name: GlobalState[Bytes]

    @arc4.abimethod(create="require")
    def create(self) -> None:
        self.counter = GlobalState(UInt64(0))
        self.name = GlobalState(Bytes(b"default"))
```

## Local State (per-user)
```python
from algopy import LocalState, UInt64

class MyContract(ARC4Contract):
    balance: LocalState[UInt64]

    @arc4.abimethod(allow_actions=["OptIn"])
    def opt_in(self) -> None:
        self.balance[Txn.sender] = UInt64(0)
```

## Box Storage (dynamic, key-value)
```python
from algopy import BoxMap, arc4

class MyContract(ARC4Contract):
    data: BoxMap[arc4.Address, arc4.UInt64]

    @arc4.abimethod()
    def set_data(self, key: arc4.Address, value: arc4.UInt64) -> None:
        self.data[key] = value
```

## Inner Transactions
```python
from algopy import itxn

@arc4.abimethod()
def send_payment(self, receiver: arc4.Address, amount: arc4.UInt64) -> None:
    itxn.Payment(
        receiver=receiver.native,
        amount=amount.native,
    ).submit()
```
""",
]


PUYATS_FALLBACK_DOCS = [
    """
# Algorand TypeScript (PuyaTs) Contract Structure

Every Algorand TypeScript smart contract follows this structure:

```typescript
import { Contract, GlobalState, abimethod, uint64, bytes, Address } from '@algorandfoundation/algorand-typescript'

class MyContract extends Contract {
  // Global state declarations
  counter = GlobalState<uint64>({ initialValue: 0 })
  owner = GlobalState<Address>()

  @abimethod({ onCreate: 'require' })
  create(): void {
    this.owner.value = this.txn.sender
  }

  @abimethod()
  increment(): uint64 {
    this.counter.value += 1
    return this.counter.value
  }

  @abimethod({ readonly: true })
  getCount(): uint64 {
    return this.counter.value
  }
}
```

Key rules:
- NEVER use TEALScript — it is legacy, superseded by Algorand TypeScript
- NEVER import external npm libraries into contract code
- Import from @algorandfoundation/algorand-typescript
- Extend Contract class
- Use @abimethod() decorator for public methods
- Use GlobalState<T> and LocalState<T> for typed state
- Use AVM-compatible types: uint64, bytes, str, bool, Address
""",
    """
# PuyaTs State, Box Storage & Inner Transactions

## Global State
```typescript
import { Contract, GlobalState, uint64, bytes } from '@algorandfoundation/algorand-typescript'

class MyContract extends Contract {
  counter = GlobalState<uint64>({ initialValue: 0 })
  name = GlobalState<bytes>({ initialValue: Bytes('default') })
}
```

## Local State (per-user)
```typescript
import { LocalState, uint64 } from '@algorandfoundation/algorand-typescript'

class MyContract extends Contract {
  balance = LocalState<uint64>()

  @abimethod({ onComplete: 'OptIn' })
  optIn(): void {
    this.balance(this.txn.sender).value = 0
  }
}
```

## Box Storage
```typescript
import { BoxMap, Address, uint64 } from '@algorandfoundation/algorand-typescript'

class MyContract extends Contract {
  data = BoxMap<Address, uint64>()

  @abimethod()
  setData(key: Address, value: uint64): void {
    this.data(key).value = value
  }
}
```

## Inner Transactions
```typescript
import { itxn, Uint64 } from '@algorandfoundation/algorand-typescript'

@abimethod()
sendAlgo(receiver: Address, amount: uint64): void {
  itxn.payment({ receiver, amount, fee: Uint64(0) }).submit()
}
```
""",
]


TEALSCRIPT_FALLBACK_DOCS = [
    """
# TealScript Contract Structure (Legacy)

> NOTE: TealScript is superseded by Algorand TypeScript (PuyaTs).
> Only use if explicitly migrating from TealScript.

```typescript
import { Contract } from '@algorandfoundation/tealscript'

class Counter extends Contract {
  counter = GlobalStateKey<uint64>()

  @allow.create('NoOp')
  createApplication(): void {
    this.counter.value = 0
  }

  @allow.call('NoOp')
  increment(): uint64 {
    this.counter.value += 1
    return this.counter.value
  }
}
```

Key differences from PuyaTs:
- Uses @allow.create() / @allow.call() instead of @abimethod()
- Uses GlobalStateKey<T> instead of GlobalState<T>
- Uses this.txn for transaction access
- Consider migrating to Algorand TypeScript (PuyaTs)
""",
]


ALGORAND_SDK_FALLBACK_DOCS = [
    """
# Algorand SDK — Transaction Building & Wallet Integration

## algosdk Client Setup
```typescript
import algosdk from 'algosdk'

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '')
const indexerClient = new algosdk.Indexer('', 'https://testnet-idx.algonode.cloud', '')
```

## Application Create Transaction
```typescript
const suggestedParams = await algodClient.getTransactionParams().do()

const txn = algosdk.makeApplicationCreateTxnFromObject({
  from: senderAddress,
  approvalProgram: compiledApproval,
  clearProgram: compiledClear,
  numGlobalInts: 1,
  numGlobalByteSlices: 1,
  numLocalInts: 0,
  numLocalByteSlices: 0,
  suggestedParams,
  onComplete: algosdk.OnApplicationComplete.NoOpOC,
})
```

## Wallet Integration (@txnlab/use-wallet)
```typescript
import { useWallet } from '@txnlab/use-wallet'

const { activeAccount, signer, providers } = useWallet()

// Sign and send transaction
const signedTxn = await signer([txn], [0])
const { txId } = await algodClient.sendRawTransaction(signedTxn).do()
const result = await algosdk.waitForConfirmation(algodClient, txId, 4)
```
""",
]


async def search_all_docs(
    query: str,
    top_k: int = 5,
) -> dict[str, list[str]]:
    """
    Search all documentation collections across all frameworks.
    Returns results grouped by framework.
    """
    results = {}

    for framework in COLLECTION_MAP.keys():
        docs = await retrieve_docs(query, framework, top_k=top_k)
        results[framework] = docs

    return results
