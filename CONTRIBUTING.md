# Contributing

Thank you for working on AlgoVibe. This document keeps the repo **review-friendly** for hackathon juries and future contributors.

---

## Repository structure

| Path | Purpose |
|------|---------|
| `backend/app/agents/` | LLM pipeline (architect, contract, react, orchestrator) |
| `backend/app/api/routes/` | FastAPI endpoints |
| `backend/app/services/` | Compiler, path verify/repair, simulator |
| `frontend/app/` | Next.js pages |
| `frontend/components/` | UI, preview, bridge, chat |
| `frontend/lib/` | Store, API client, Sandpack helpers |
| `docs/` | Human-facing guides (setup, API, contracts) |
| `ARCHITECTURE.md` | System design (source of truth for architecture) |

Do not commit:

- `.env`, API keys, mnemonics
- `backend/build_sessions.json` (runtime state)
- `node_modules/`, `.next/`, `__pycache__/`

See `.gitignore`.

---

## Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

**Examples:**

```
feat(frontend): add BYOK settings modal
fix(bridge): exclude pay ABI args from args length check
docs: add setup guide and env example
chore: add .env.example
```

**Rules:**

- One logical change per commit when possible.
- Avoid messages like `wip`, `fix`, `stuff`, `crazy`, `final final`.
- Do not mix unrelated backend + frontend + docs in one commit unless tiny.

---

## Branches

| Branch | Use |
|--------|-----|
| `master` | Main development |
| `release/round3` | Submission / jury review — clean doc commits on top |

For demos and submission links, prefer **`release/round3`** or a tagged release.

---

## Pull request checklist

- [ ] `README.md` links still valid if you moved docs
- [ ] `.env.example` updated if new config keys added
- [ ] No secrets in diff
- [ ] Backend: `uvicorn app.main:app` starts
- [ ] Frontend: `npm run dev` starts
- [ ] Tip Jar or simple prompt still reaches preview (smoke test)

---

## Code style

- Match existing patterns in the file you edit.
- Python: follow `backend/app` conventions (async FastAPI, pydantic models).
- TypeScript/React: follow Next.js app router and existing component structure.

---

## Questions

See [docs/SETUP.md](docs/SETUP.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
