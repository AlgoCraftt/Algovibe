# 🌊 AlgoVibe

### **The Intelligent DApp Orchestrator for Algorand**

[![Algorand](https://img.shields.io/badge/Blockchain-Algorand-black?logo=algorand)](https://algorand.foundation/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Vision
**AlgoVibe** is a production-ready agentic platform designed to democratize Algorand development. By leveraging a multi-agent orchestration layer and a deep RAG (Retrieval-Augmented Generation) pipeline, AlgoVibe transforms natural language prompts into fully functional, deployed Decentralized Applications.

The "vibe" is simple: **You describe it. We build, compile, and deploy it.**

---

## ✨ Core Features

### 🧠 1. Multi-Agent Orchestration
AlgoVibe isn't just a wrapper; it's a team of specialized AI agents:
- **The Architect**: Designs the project structure and contract interfaces.
- **The Logic Agent**: Writes high-performance PuyaPy/PuyaTS smart contracts.
- **The UI Generator**: Builds a corresponding React frontend that interacts seamlessly with the contracts.
- **The Orchestrator**: Synchronizes the entire build lifecycle.

### 🛠️ 2. Self-Healing Compiler
Blockchain development is unforgiving. AlgoVibe features a closed-loop **Self-Healing Compiler** that:
1. Compiles the generated TEAL/Python code.
2. Captures errors in the Puya/TEAL check phase.
3. Automatically feeds errors back to the AI for instant rectification.
4. Loops until the build is 100% valid.

### 📚 3. Algorand-Native RAG
Built on a custom vector store containing the latest documentation for:
- **PuyaPy & PuyaTS**
- **ARC-32 (Application Binary Interface)**
- **Algorand Python SDK**
Ensures the AI writes modern, secure code that follows the latest best practices.

### 🚢 4. One-Click Production
- **Testnet Anchoring**: Deploy your identity and contract hashes directly to Algorand Testnet.
- **Vercel Publishing**: Publish your generated frontend to a live production URL with one click.
- **Sandpack Preview**: Edit and test your generated code in a live, interactive IDE within the browser.

---

## 🏗️ Technical Architecture

### **The Stack**
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Zustand.
- **Backend**: FastAPI (Python), LangChain, OpenRouter (Claude 3.5 Sonnet).
- **Database/Storage**: ChromaDB (Vector Store), PostgreSQL.
- **Integration**: Algorand SDKs, Vercel API.

### **The Build Pipeline**
1. **Prompt**: User describes an NFT Auction or a ZK-KYC bridge.
2. **Retrieve**: RAG pipeline pulls relevant Algorand contract patterns.
3. **Draft**: AI agents generate Smart Contract + Frontend Bridge + React UI.
4. **Heal**: Compiler validates the code; errors trigger automatic fixes.
5. **Deploy**: Contract is ready for Testnet; Frontend is pushed to Vercel.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Algorand Testnet Account (KMD or Mnemonic)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AlgoCraftt/Algovibe.git
   cd Algovibe
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   pip install -r requirements.txt
   cp .env.example .env  # Add your API keys (OpenRouter/Anthropic)
   python main.py
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🔒 Security & Verification
AlgoVibe anchors development sessions to the Algorand blockchain, creating a verifiable record of the build process and ensuring the integrity of the generated artifacts.

---

## 🤝 Contributing
We welcome contributions! Whether it's adding new protocol templates or improving the agentic logic, feel free to open a PR.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ for the <strong>Algorand Ecosystem</strong>.
</p>
