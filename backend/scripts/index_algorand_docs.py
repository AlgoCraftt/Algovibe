"""
Index Algorand knowledge base into ChromaDB for RAG retrieval.

Usage:
    cd backend
    python scripts/index_algorand_docs.py

Processes 3 source types:
1. llm_full.txt    — scraped Algorand Developer Portal (section-aware chunking)
2. llm_abridged.txt — abridged docs (supplementary)
3. algorand-agent-skills/ — official agent skill files + references

Generates embeddings using sentence-transformers and stores
in ChromaDB with metadata (source, framework, category).
"""

import re
import chromadb
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"
CHROMA_DIR = KNOWLEDGE_DIR / "chroma_db"

# ── Section-to-collection routing for llm_full.txt ──────────────────────
# The scraped docs have section headers that map to frameworks/topics.
SECTION_ROUTING = {
    # Framework-specific
    r"algorand.python|puyapy|algopy|algorand python": "algorand-puyapy",
    r"algorand.typescript|puyats|puya-ts|algorand typescript": "algorand-puyats",
    r"tealscript": "algorand-tealscript",
    # SDK / transactions / deployment
    r"algosdk|javascript.sdk|python.sdk|algokit.utils|transaction|arc-?32|arc-?56|arc-?4": "algorand-sdk",
    # Core AVM / general
    r"avm|opcode|teal|box.storage|inner.transaction|state|consensus|smart.contract": "algorand-core",
}

# ── Skill-to-collection routing ─────────────────────────────────────────
SKILL_ROUTING = {
    "build-smart-contracts": "algorand-skills",
    "algorand-typescript": "algorand-puyats",     # PuyaTs syntax rules → puyats collection
    "algorand-ts-migration": "algorand-puyats",   # Migration guides → puyats
    "call-smart-contracts": "algorand-sdk",        # Deploy/interact → sdk collection
    "deploy-react-frontend": "algorand-sdk",       # Frontend patterns → sdk
    "test-smart-contracts": "algorand-skills",
    "use-algokit-cli": "algorand-skills",
    "use-algokit-utils": "algorand-sdk",
    "implement-arc-standards": "algorand-sdk",
    "search-algorand-examples": "algorand-skills",
    "troubleshoot-errors": "algorand-skills",
    "create-project": "algorand-skills",
    "algorand-ecosystem": "algorand-core",
}


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
    return chunks


def route_section(section_title: str) -> str:
    """Route a doc section to the appropriate ChromaDB collection."""
    title_lower = section_title.lower()
    for pattern, collection in SECTION_ROUTING.items():
        if re.search(pattern, title_lower):
            return collection
    return "algorand-core"  # default fallback


def index_scraped_docs(client: chromadb.ClientAPI):
    """Index llm_full.txt with section-aware chunking."""
    llm_full = KNOWLEDGE_DIR / "llm_full.txt"
    if not llm_full.exists():
        print("WARNING: llm_full.txt not found, skipping")
        return

    print(f"Reading {llm_full.name} ({llm_full.stat().st_size / 1024 / 1024:.1f}MB)...")
    text = llm_full.read_text(encoding="utf-8", errors="replace")

    # Split by major section headers (# or ## lines)
    sections = re.split(r'\n(?=#{1,2}\s)', text)
    total_chunks = 0

    for section in sections:
        if not section.strip():
            continue

        # Extract section title from first line
        first_line = section.split('\n', 1)[0].strip('# ').strip()
        collection_name = route_section(first_line)

        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        chunks = chunk_text(section)
        for i, chunk in enumerate(chunks):
            doc_id = f"llm_full_{hash(first_line) % 100000}_{i}"
            collection.upsert(
                ids=[doc_id],
                documents=[chunk],
                metadatas=[{
                    "source": "llm_full.txt",
                    "section": first_line[:100],
                    "chunk_index": i,
                }]
            )
            total_chunks += 1

    print(f"Indexed {total_chunks} chunks from llm_full.txt")


def index_agent_skills(client: chromadb.ClientAPI):
    """Index all SKILL.md files + their references/ subdirectories."""
    skills_dir = KNOWLEDGE_DIR / "algorand-agent-skills" / "skills"
    if not skills_dir.exists():
        print("WARNING: algorand-agent-skills/skills/ not found, skipping")
        return

    total_chunks = 0
    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue

        skill_name = skill_dir.name
        collection_name = SKILL_ROUTING.get(skill_name, "algorand-skills")

        collection = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        # Index SKILL.md + all reference files
        for file_path in skill_dir.rglob("*"):
            if file_path.suffix not in [".md", ".py", ".ts", ".txt"]:
                continue

            text = file_path.read_text(encoding="utf-8", errors="replace")
            chunks = chunk_text(text)

            for i, chunk in enumerate(chunks):
                doc_id = f"skill_{skill_name}_{file_path.stem}_{i}"
                collection.upsert(
                    ids=[doc_id],
                    documents=[chunk],
                    metadatas=[{
                        "source": "agent-skills",
                        "skill": skill_name,
                        "file": str(file_path.relative_to(skills_dir)),
                        "chunk_index": i,
                    }]
                )
                total_chunks += 1

    print(f"Indexed {total_chunks} chunks from agent skills")


def index_agents_md(client: chromadb.ClientAPI):
    """Index the canonical AGENTS.md instruction set."""
    agents_md = KNOWLEDGE_DIR / "algorand-agent-skills" / "setups" / "AGENTS.md"
    if not agents_md.exists():
        print("WARNING: AGENTS.md not found, skipping")
        return

    collection = client.get_or_create_collection(
        name="algorand-skills",
        metadata={"hnsw:space": "cosine"}
    )

    text = agents_md.read_text(encoding="utf-8", errors="replace")
    chunks = chunk_text(text)
    for i, chunk in enumerate(chunks):
        collection.upsert(
            ids=[f"agents_md_{i}"],
            documents=[chunk],
            metadatas=[{
                "source": "AGENTS.md",
                "file": "setups/AGENTS.md",
                "chunk_index": i,
            }]
        )
    print(f"Indexed {len(chunks)} chunks from AGENTS.md")



def main():
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    cleanup_old_collections(client)
    index_scraped_docs(client)
    index_agent_skills(client)
    index_agents_md(client)

    # Print summary
    print("\n── Collection Summary ──")
    for col in client.list_collections():
        print(f"  {col.name}: {col.count()} documents")
    print("Done!")


if __name__ == "__main__":
    main()
