"""
RAG Retriever - Fallback Mode (Vercel-friendly)

This version bypasses ChromaDB to keep the build size within Vercel's limits.
It relies on high-quality curated documentation for each Algorand framework.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


async def retrieve_docs(
    query: str,
    framework: str,           # "puyapy" | "puyats" | "tealscript"
    doc_type: str = None,     # DEPRECATED
    top_k: int = None,
) -> list[str]:
    """
    Directly return curated fallback documentation since RAG is disabled in production.
    """
    return get_fallback_docs(framework)


def get_fallback_docs(framework: str) -> list[str]:
    """
    Return essential documentation snippets for each framework.
    """
    if framework == "puyapy":
        return PUYAPY_FALLBACK_DOCS
    elif framework == "puyats":
        return PUYATS_FALLBACK_DOCS
    elif framework == "tealscript":
        return TEALSCRIPT_FALLBACK_DOCS
    else:
        return PUYATS_FALLBACK_DOCS


# ── Curated Documentation Snippets ──────────────────────────────────────

PUYAPY_FALLBACK_DOCS = [
    """
# Algorand Python (PuyaPy) Contract Structure
Every Algorand Python smart contract follows this structure:

```python
from algopy import ARC4Contract, arc4, GlobalState, UInt64, Txn

class MyContract(ARC4Contract):
    counter: GlobalState[UInt64]

    @arc4.abimethod(create="require")
    def create(self) -> None:
        self.counter = GlobalState(UInt64(0))

    @arc4.abimethod()
    def increment(self) -> arc4.UInt64:
        self.counter.value += UInt64(1)
        return arc4.UInt64(self.counter.value)
```
Key rules: Extend ARC4Contract, use @arc4.abimethod, and use algopy types.
""",
    """
# PuyaPy Inner Transactions
```python
from algopy import itxn, arc4

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
```typescript
import { Contract, GlobalState, abimethod, uint64 } from '@algorandfoundation/algorand-typescript'

class MyContract extends Contract {
  counter = GlobalState<uint64>({ initialValue: 0 })

  @abimethod()
  increment(): uint64 {
    this.counter.value += 1
    return this.counter.value
  }
}
```
""",
]

TEALSCRIPT_FALLBACK_DOCS = [
    "# TealScript (Legacy)\nRefer to PuyaTs for modern Algorand development.",
]

async def search_all_docs(
    query: str,
    top_k: int = 5,
) -> dict[str, list[str]]:
    """ nhóm results grouped by framework. """
    return {
        "puyapy": PUYAPY_FALLBACK_DOCS,
        "puyats": PUYATS_FALLBACK_DOCS,
        "tealscript": TEALSCRIPT_FALLBACK_DOCS
    }
