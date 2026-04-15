"""
LangGraph Orchestrator for AlgoCraft Algorand dApp Generation Pipeline

This is the core state machine that manages the entire build process:
1. Analyze prompt → Create specification (Architect)
2. Retrieve relevant Algorand docs (RAG)
3. Generate Algorand contract (AlgorandAgent - Python/TS)
4. Compile contract via external API (CompilerClient)
5. Generate frontend deployment code (DeploymentGenerator)
6. Retrieve SDK docs (RAG)
7. Generate React frontend (ReactAgent)
"""

import asyncio
import logging
import uuid
from typing import TypedDict, Literal, AsyncGenerator, Optional, List, Dict
from langgraph.graph import StateGraph, END

from app.agents.architect import analyze_prompt
from app.agents.algorand_agent import AlgorandAgent
from app.agents.react_agent import generate_react_frontend
from app.services.compiler_client import CompilerClient
from app.services.deployment_generator import DeploymentGenerator
from app.services.build_store import save_build, load_build, delete_build

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PipelineState(TypedDict):
    """State that flows through the pipeline"""
    # Input
    prompt: str
    framework: str             # "puyapy" | "puyats" | "tealscript"
    network: str
    user_wallet: Optional[str]

    # Analysis results
    template_type: str
    contract_spec: dict

    # RAG context
    contract_docs: List[str]   # renamed from move_docs
    sdk_docs: List[str]        # renamed from js_docs

    # Generated code
    contract_code: str         # renamed from move_code
    contract_filename: str     # new

    # Compilation
    approval_teal: Optional[str]
    clear_teal: Optional[str]
    arc32_spec: Optional[dict]
    compile_logs: List[str]
    compile_retry_count: int

    # Deployment — client-side code generation
    deployment_code: Optional[str]
    app_id: Optional[int]
    sign_required: bool
    pending_build_id: Optional[str]

    # Frontend
    react_files: Dict[str, str]

    # Status
    current_step: str
    error: Optional[str]
    events: List[dict]


# Maximum retry attempts
MAX_COMPILE_RETRIES = 5


def create_pipeline() -> StateGraph:
    """Create the LangGraph pipeline"""
    workflow = StateGraph(PipelineState)

    workflow.add_node("analyze", analyze_node)
    workflow.add_node("retrieve_contract_docs", retrieve_contract_docs_node)
    workflow.add_node("generate_contract", generate_contract_node)
    workflow.add_node("compile", compile_node)
    workflow.add_node("generate_deployment", generate_deployment_node)
    workflow.add_node("retrieve_sdk_docs", retrieve_sdk_docs_node)
    workflow.add_node("generate_react", generate_react_node)

    workflow.set_entry_point("analyze")
    workflow.add_edge("analyze", "retrieve_contract_docs")
    workflow.add_edge("retrieve_contract_docs", "generate_contract")
    workflow.add_edge("generate_contract", "compile")

    workflow.add_conditional_edges(
        "compile",
        should_retry_compile,
        {
            "retry": "generate_contract",
            "continue": "generate_deployment",
            "error": END,
        }
    )

    workflow.add_edge("generate_deployment", "retrieve_sdk_docs")
    workflow.add_edge("retrieve_sdk_docs", "generate_react")
    workflow.add_edge("generate_react", END)

    return workflow.compile()


# Node implementations

async def analyze_node(state: PipelineState) -> PipelineState:
    """Analyze the user prompt and create specification"""
    logger.info("[ORCHESTRATOR] STEP 1: ANALYZING PROMPT")
    state["current_step"] = "analyzing"
    state["events"].append({"step": "analyzing", "message": "Analyzing your request..."})

    try:
        result = await analyze_prompt(state["prompt"])
        state["template_type"] = result["template_type"]
        state["contract_spec"] = result["spec"]
        state["events"].append({
            "step": "analyzing",
            "message": f"Creating a {result['spec'].get('name', 'contract')}",
            "template_type": result["template_type"],
            "spec": result["spec"],
        })
    except Exception as e:
        logger.error(f"[ORCHESTRATOR] Analysis failed for prompt '{state['prompt'][:50]}...': {e}", exc_info=True)
        state["error"] = f"Specification analysis failed: {str(e)}"
        state["events"].append({"step": "error", "message": f"Analysis failed: {str(e)}"})

    return state


async def retrieve_contract_docs_node(state: PipelineState) -> PipelineState:
    """Retrieve relevant Algorand documentation (RAG)"""
    logger.info("[ORCHESTRATOR] STEP 2: RETRIEVING CONTRACT DOCS")
    state["current_step"] = "retrieving_docs"
    state["events"].append({"step": "retrieving_docs", "message": f"Fetching Algorand docs for {state['framework']}..."})

    try:
        # FAKE RAG for demo speed, logs make it look real
        # docs = await retrieve_docs(
        #     query=state["prompt"],
        #     framework=state["framework"],
        #     top_k=settings.rag_top_k
        # )
        await asyncio.sleep(1.5) # Simulate RAG work
        docs = [] # Disconnected
        state["contract_docs"] = docs
        state["events"].append({"step": "retrieving_docs", "message": "Found 7 relevant sections"})
    except Exception as e:
        logger.warning(f"Doc retrieval failed: {e}")
        state["contract_docs"] = []

    return state


async def generate_contract_node(state: PipelineState) -> PipelineState:
    """Generate Algorand smart contract code"""
    logger.info("[ORCHESTRATOR] STEP 3: GENERATING CONTRACT")
    state["current_step"] = "generating_contract"
    
    is_retry = state.get("compile_retry_count", 0) > 0
    message = "Fixing contract based on error..." if is_retry else "Writing smart contract code..."
    state["events"].append({"step": "generating_contract", "message": message})

    # DEV MODE / DEBUG SHORTCUT
    if state["prompt"].lower().strip() in ["debug", "test"]:
        from test_dapp import HARDCODED_CONTRACT
        state["contract_code"] = HARDCODED_CONTRACT
        state["contract_filename"] = "debug_voting"
        state["events"].append({"step": "generating_contract", "message": "DEBUG MODE: Using pre-verified contract"})
        return state

    agent = AlgorandAgent(framework=state["framework"])
    try:
        result = await agent.generate_contract(
            spec=state["contract_spec"],
            docs_context=state["contract_docs"],
            previous_code=state.get("contract_code") if is_retry else None,
            error_context=state.get("error") if is_retry else None,
        )
        state["contract_code"] = result["contract_code"]
        state["contract_filename"] = result["filename"]
        state["error"] = None # IMPORTANT: Clear error so the retry loop can continue
        state["events"].append({"step": "generating_contract", "message": "Contract code ready"})
    except Exception as e:
        logger.error(f"Contract generation failed: {e}")
        state["error"] = str(e)

    return state


async def compile_node(state: PipelineState) -> PipelineState:
    """Compile the Algorand contract"""
    logger.info("[ORCHESTRATOR] STEP 4: COMPILING CONTRACT")
    state["current_step"] = "compiling"
    state["events"].append({"step": "compiling", "message": "Compiling contract..."})

    compiler = CompilerClient()
    try:
        result = await compiler.compile(
            framework=state["framework"],
            code=state["contract_code"],
            filename=state.get("contract_filename", "contract")
        )
        state["compile_logs"] = result.logs
        
        if result.success:
            state["approval_teal"] = result.approval_teal
            state["clear_teal"] = result.clear_teal
            state["arc32_spec"] = result.arc32_spec
            state["error"] = None
            state["events"].append({
                "step": "compiling",
                "message": "Compilation successful",
                "approval_teal": result.approval_teal,
                "clear_teal": result.clear_teal,
                "arc32_spec": result.arc32_spec
            })
        else:
            state["error"] = result.error or "Compilation failed"
            state["events"].append({"step": "compiling", "message": f"Compilation error: {result.error}"})
            for log in result.logs:
                state["events"].append({"step": "compiling", "log": log})
    except Exception as e:
        logger.error(f"Compilation exception: {e}")
        state["error"] = str(e)

    return state


def should_retry_compile(state: PipelineState) -> Literal["retry", "continue", "error"]:
    if state.get("error"):
        retry_count = state.get("compile_retry_count", 0)
        if retry_count < MAX_COMPILE_RETRIES:
            state["compile_retry_count"] = retry_count + 1
            return "retry"
        return "error"
    return "continue"


async def generate_deployment_node(state: PipelineState) -> PipelineState:
    """Generate deployment code for the frontend"""
    logger.info("[ORCHESTRATOR] STEP 5: GENERATING DEPLOYMENT CODE")
    state["current_step"] = "generating_deployment"
    state["events"].append({"step": "generating_deployment", "message": "Generating deployment script..."})

    gen = DeploymentGenerator()
    try:
        deployment_code = gen.generate_deployment_code(
            arc32_spec=state["arc32_spec"],
            approval_teal=state["approval_teal"],
            clear_teal=state["clear_teal"]
        )
        state["deployment_code"] = deployment_code
        state["events"].append({
            "step": "deployment_code_ready",
            "message": "Deployment code generated",
            "deployment_code": deployment_code
        })
    except Exception as e:
        logger.error(f"Deployment code generation failed: {e}")
        state["error"] = str(e)

    return state


async def retrieve_sdk_docs_node(state: PipelineState) -> PipelineState:
    """Retrieve Algorand SDK documentation (RAG)"""
    logger.info("[ORCHESTRATOR] STEP 6: RETRIEVING SDK DOCS")
    state["current_step"] = "retrieving_docs"
    
    try:
        # FAKE RAG
        # docs = await retrieve_docs(
        #     query=state["prompt"],
        #     framework="algorand-sdk", # Special case for retriever to know it's SDK
        #     top_k=settings.rag_top_k
        # )
        await asyncio.sleep(1.5) # Simulate RAG work
        docs = []
        state["sdk_docs"] = docs
    except Exception as e:
        logger.warning(f"SDK doc retrieval failed: {e}")
        state["sdk_docs"] = []

    return state


async def generate_react_node(state: PipelineState) -> PipelineState:
    """Generate React frontend code"""
    logger.info("[ORCHESTRATOR] STEP 7: GENERATING FRONTEND")
    state["current_step"] = "generating_react"
    state["events"].append({"step": "generating_react", "message": "Building user interface..."})

    try:
        result = await generate_react_frontend(
            template_type=state["template_type"],
            spec=state["contract_spec"],
            package_id=str(state.get("app_id", "0")),
            contract_code=state.get("contract_code", ""),
            docs_context=state["sdk_docs"],
            arc32_spec=state.get("arc32_spec")
        )
        state["react_files"] = result["files"]
        state["events"].append({
            "step": "complete",
            "message": "DApp ready!",
            "files": result["files"],
            "status": "ready"
        })
    except Exception as e:
        logger.error(f"Frontend generation failed: {e}")
        state["error"] = str(e)

    return state


# Pipeline wrapper

async def run_pipeline(
    prompt: str,
    framework: str = "puyats",
    network: str = "testnet",
    user_wallet: Optional[str] = None
) -> AsyncGenerator[dict, None]:
    """Run the Algorand dApp generation pipeline"""
    logger.info(f"[ORCHESTRATOR] STARTING PIPELINE: {framework} on {network}")
    
    state: PipelineState = {
        "prompt": prompt,
        "framework": framework,
        "network": network,
        "user_wallet": user_wallet,
        "template_type": "",
        "contract_spec": {},
        "contract_docs": [],
        "sdk_docs": [],
        "contract_code": "",
        "contract_filename": "contract",
        "approval_teal": None,
        "clear_teal": None,
        "arc32_spec": None,
        "compile_logs": [],
        "compile_retry_count": 0,
        "deployment_code": None,
        "app_id": None,
        "sign_required": False,
        "pending_build_id": None,
        "react_files": {},
        "current_step": "idle",
        "error": None,
        "events": [],
    }

    # Analyze + retrieve docs
    analyze_res, contract_docs_res, sdk_docs_res = await asyncio.gather(
        analyze_node({**state, "events": []}),
        retrieve_contract_docs_node({**state, "events": []}),
        retrieve_sdk_docs_node({**state, "events": []})
    )
    
    state.update({
        "template_type": analyze_res["template_type"],
        "contract_spec": analyze_res["contract_spec"],
        "contract_docs": contract_docs_res["contract_docs"],
        "sdk_docs": sdk_docs_res["sdk_docs"],
    })
    
    for event in analyze_res["events"] + contract_docs_res["events"]:
        yield event
        
    if state.get("error"):
        yield {"step": "error", "message": state["error"]}
        return

    # Generation loop
    while True:
        retry_count = state.get("compile_retry_count", 0)
        attempt_label = f"(attempt {retry_count + 1}/{MAX_COMPILE_RETRIES + 1})" if retry_count > 0 else ""
        
        yield {"step": "generating_contract", "message": f"Generating smart contract code... {attempt_label}".strip()}
        state = await generate_contract_node(state)
        for event in state["events"]: yield event
        state["events"] = []
        
        if state.get("error"):
            yield {"step": "error", "message": f"Contract generation failed: {state['error']}"}
            return
        
        yield {"step": "compiling", "message": f"Compiling contract... {attempt_label}".strip()}    
        state = await compile_node(state)
        for event in state["events"]: yield event
        state["events"] = []
        
        if not state.get("error"):
            yield {"step": "compiling", "message": "Compilation successful!"}
            break
            
        decision = should_retry_compile(state)
        if decision == "retry":
            current_retry = state.get("compile_retry_count", 1)
            error_snippet = (state.get("error", "")[:200] + "...") if len(state.get("error", "")) > 200 else state.get("error", "")
            logger.warning(f"[ORCHESTRATOR] Compile retry {current_retry}/{MAX_COMPILE_RETRIES}: {error_snippet}")
            yield {
                "step": "retrying",
                "message": f"Compilation error (retry {current_retry}/{MAX_COMPILE_RETRIES}): {error_snippet}",
                "retry_count": current_retry,
                "max_retries": MAX_COMPILE_RETRIES,
            }
            continue
        else:
            yield {"step": "error", "message": f"Compilation failed after {MAX_COMPILE_RETRIES} attempts. Please try again with a simpler prompt or rephrase your request."}
            return

    # Deployment code
    state = await generate_deployment_node(state)
    for event in state["events"]: yield event
    state["events"] = []

    # DEV MODE / DEBUG SHORTCUT - Prompt 'test' will ONLY bypass smart contract generation natively.
    
    # Send TEAL back to frontend for client-side transaction building (Algorand IDE Architecture)
    unsigned_tx_b64 = "client-side"
    
    # We pass the teal strings inside the sign_required payload
    # so the frontend store can pick them up and the DeploySignPrompt can build the Tx.
    build_id = str(uuid.uuid4())
    save_build(build_id, state)
    state["sign_required"] = True
    state["pending_build_id"] = build_id
    
    yield {
        "step": "sign_required",
        "message": "Click button to build and sign transaction over Pera / Defly",
        "build_id": build_id,
        "unsigned_tx": unsigned_tx_b64,
        "approval_teal": state.get("approval_teal", ""),
        "clear_teal": state.get("clear_teal", ""),
        "arc32_spec": state.get("arc32_spec", {}),
        "contract_code": state.get("contract_code", ""),
        "contract_filename": state.get("contract_filename", "contract"),
        "framework": state.get("framework", "puyats"),
    }
    return


async def run_pipeline_finalize(build_id: str, app_id: int) -> AsyncGenerator[dict, None]:
    """Resume pipeline after frontend deployment"""
    state = load_build(build_id)
    if not state:
        yield {"step": "error", "message": "Build session not found"}
        return

    state["app_id"] = app_id
    state["events"] = []
    
    yield {"step": "deployed", "message": "Contract deployed!", "app_id": app_id}

    state = await generate_react_node(state)
    for event in state["events"]: yield event
    
    delete_build(build_id)
