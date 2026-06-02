"""
AlgoVibe Pipeline Test Harness (HTTP Client)
==============================================
Connects to your RUNNING backend server and streams the generation pipeline.
Shows all SSE events, contract code, compilation results, and frontend output.

No backend dependencies needed — uses only stdlib (urllib, json).

Usage:
    python test_pipeline.py
    python test_pipeline.py "Build a voting app"
    python test_pipeline.py --x402
    python test_pipeline.py --x402 --key sk-or-... --model google/gemini-2.5-flash-preview
    python test_pipeline.py --url http://localhost:8000

Requirements:
    - Backend already running (default: http://localhost:8000)
    - That's it. No pip install needed.
"""

import sys
import json
import time
import argparse
import os
from datetime import datetime

# Use only stdlib — no pip dependencies
try:
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError
except ImportError:
    print("ERROR: Python stdlib urllib not available")
    sys.exit(1)


# ============================================================================
# ANSI colors
# ============================================================================
class C:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    END = '\033[0m'

# Disable colors on Windows if not supported
if sys.platform == 'win32':
    try:
        os.system('')  # Enable ANSI on Windows 10+
    except:
        pass


def banner(text, color=C.HEADER):
    w = 70
    print(f"\n{color}{'=' * w}")
    print(f"  {text}")
    print(f"{'=' * w}{C.END}\n")


def section(text, color=C.CYAN):
    print(f"\n{color}{'_' * 60}")
    print(f"  {text}")
    print(f"{'_' * 60}{C.END}")


# ============================================================================
# SSE Stream Reader (stdlib only)
# ============================================================================
def stream_sse(url, body, headers):
    """
    POST to url, read SSE stream, yield parsed JSON events.
    Uses only urllib (no requests/httpx).
    """
    data = json.dumps(body).encode('utf-8')
    req = Request(url, data=data, headers=headers, method='POST')

    try:
        response = urlopen(req, timeout=300)
    except HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace')
        print(f"{C.RED}HTTP {e.code}: {error_body[:500]}{C.END}")
        return
    except URLError as e:
        print(f"{C.RED}Connection failed: {e.reason}{C.END}")
        print(f"  Is the backend running at {url.rsplit('/api', 1)[0]}?")
        return

    buffer = ''
    for chunk in iter(lambda: response.read(1024), b''):
        buffer += chunk.decode('utf-8', errors='replace')
        while '\n' in buffer:
            line, buffer = buffer.split('\n', 1)
            line = line.strip()
            if line.startswith('data: '):
                json_str = line[6:]
                try:
                    event = json.loads(json_str)
                    yield event
                except json.JSONDecodeError:
                    print(f"{C.DIM}  [unparseable: {json_str[:100]}]{C.END}")

    # Flush remaining buffer
    if buffer.strip().startswith('data: '):
        json_str = buffer.strip()[6:]
        try:
            yield json.loads(json_str)
        except json.JSONDecodeError:
            pass


# ============================================================================
# Main test
# ============================================================================
def run_test(prompt, framework, network, api_key, model, backend_url):
    banner("ALGOVIBE PIPELINE TEST", C.BOLD + C.GREEN)
    print(f"{C.BOLD}Prompt:{C.END}     {prompt}")
    print(f"{C.BOLD}Framework:{C.END}  {framework}")
    print(f"{C.BOLD}Network:{C.END}    {network}")
    print(f"{C.BOLD}Model:{C.END}      {model}")
    print(f"{C.BOLD}Backend:{C.END}    {backend_url}")
    print(f"{C.BOLD}Time:{C.END}       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check backend health
    section("HEALTH CHECK", C.CYAN)
    try:
        health_req = Request(f"{backend_url}/health")
        health_resp = urlopen(health_req, timeout=5)
        health = json.loads(health_resp.read().decode('utf-8'))
        print(f"  Status:  {C.GREEN}{health.get('status', '?')}{C.END}")
        print(f"  LLM:     {health.get('llm', '?')} / {health.get('model', '?')}")
        print(f"  Network: {health.get('algorand_network', '?')}")
    except Exception as e:
        print(f"{C.RED}  Backend not reachable: {e}{C.END}")
        print(f"  Make sure the backend is running at {backend_url}")
        return

    # Build request
    url = f"{backend_url}/api/v1/generate"
    body = {
        "prompt": prompt,
        "framework": framework,
        "network": network,
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    # BYOK headers — pass API key and model to override server defaults
    if api_key:
        headers["X-LLM-Provider"] = "openrouter"
        headers["X-LLM-Api-Key"] = api_key
    if model:
        headers["X-LLM-Model"] = model

    # Stream the pipeline
    banner("PIPELINE STREAM", C.HEADER)
    
    events = []
    contract_code = None
    arc32_spec = None
    approval_teal = None
    build_id = None
    template_type = None
    spec = None
    frontend_files = None
    start_time = time.time()

    for event in stream_sse(url, body, headers):
        events.append(event)
        step = event.get("step", "?")
        message = event.get("message", "")

        # Color-code by step
        if step == "error":
            print(f"  {C.RED}[{step}] {message}{C.END}")
            if event.get("error_code") == "invalid_api_key":
                print(f"\n{C.RED}  Your API key was rejected. Check it and try again.{C.END}")
            break
        elif step == "compiling" and "successful" in message.lower():
            print(f"  {C.GREEN}[{step}] {message}{C.END}")
        elif step == "retrying":
            print(f"  {C.YELLOW}[{step}] {message}{C.END}")
        elif step == "sign_required":
            print(f"  {C.GREEN}[{step}] {message}{C.END}")
        else:
            print(f"  {C.DIM}[{step}]{C.END} {message}")

        # Capture important data
        if step == "analyzing" and "spec" in event:
            template_type = event.get("template_type")
            spec = event.get("spec")
        
        if step == "generating_contract" and "Contract code ready" in message:
            pass  # code comes in sign_required
        
        if step == "compiling" and event.get("approval_teal"):
            approval_teal = event.get("approval_teal")
            arc32_spec = event.get("arc32_spec")

        if step == "sign_required":
            build_id = event.get("build_id")
            contract_code = event.get("contract_code")
            approval_teal = event.get("approval_teal") or approval_teal
            arc32_spec = event.get("arc32_spec") or arc32_spec

        if step == "complete" and event.get("files"):
            frontend_files = event.get("files")

    elapsed = time.time() - start_time

    # ── RESULTS ────────────────────────────────────────────────────────────
    banner("RESULTS", C.BOLD + C.GREEN)
    
    print(f"  {C.BOLD}Total time:{C.END}      {elapsed:.1f}s")
    print(f"  {C.BOLD}Events:{C.END}          {len(events)}")
    print(f"  {C.BOLD}Template type:{C.END}   {template_type or 'N/A'}")
    print(f"  {C.BOLD}Build ID:{C.END}        {build_id or 'N/A'}")
    
    # Show spec
    if spec:
        section("CONTRACT SPEC (from Architect)", C.CYAN)
        print(json.dumps(spec, indent=2)[:3000])

    # Show contract code
    if contract_code:
        section("GENERATED CONTRACT CODE", C.GREEN)
        lines = contract_code.split('\n')
        for i, line in enumerate(lines[:100]):
            print(f"  {C.DIM}{i+1:3}{C.END} {line}")
        if len(lines) > 100:
            print(f"  {C.YELLOW}... ({len(lines) - 100} more lines){C.END}")
        print(f"\n  {C.BOLD}Total: {len(lines)} lines{C.END}")
    else:
        print(f"\n  {C.RED}No contract code captured (pipeline may have failed before sign_required){C.END}")

    # Show TEAL
    if approval_teal:
        section("APPROVAL TEAL (compiled)", C.GREEN)
        teal_lines = approval_teal.split('\n')
        print(f"  {C.BOLD}{len(teal_lines)} lines of TEAL{C.END}")
        for line in teal_lines[:20]:
            print(f"  {C.DIM}{line}{C.END}")
        if len(teal_lines) > 20:
            print(f"  {C.YELLOW}... ({len(teal_lines) - 20} more lines){C.END}")

    # Show ARC32
    if arc32_spec:
        section("ARC32 SPEC", C.CYAN)
        methods = arc32_spec.get("contract", {}).get("methods", [])
        print(f"  {C.BOLD}Methods:{C.END} {[m.get('name') for m in methods]}")
        state = arc32_spec.get("state", {})
        if state:
            print(f"  {C.BOLD}Global schema:{C.END} {state.get('global', {})}")
            print(f"  {C.BOLD}Local schema:{C.END}  {state.get('local', {})}")

    # Show frontend (if we got to finalize — only happens after deploy)
    if frontend_files:
        section("FRONTEND FILES", C.GREEN)
        for path, content in frontend_files.items():
            print(f"  {path} ({len(content.split(chr(10)))} lines)")

    # ── PIPELINE STATUS ────────────────────────────────────────────────────
    print()
    if build_id and contract_code and approval_teal:
        banner("PIPELINE SUCCESS - Contract compiled & ready for deploy", C.BOLD + C.GREEN)
        print(f"  The pipeline reached {C.GREEN}sign_required{C.END} — contract is compiled")
        print(f"  and waiting for wallet signature to deploy.")
        print(f"  Build ID: {build_id}")
        print(f"\n  {C.DIM}To test frontend generation, deploy via the UI and the")
        print(f"  finalize step will generate App.tsx + hooks.{C.END}")
    elif any(e.get("step") == "error" for e in events):
        last_error = next((e for e in reversed(events) if e.get("step") == "error"), {})
        banner("PIPELINE FAILED", C.BOLD + C.RED)
        print(f"  Error: {last_error.get('message', 'Unknown')}")
    else:
        banner("PIPELINE INCOMPLETE", C.YELLOW)
        print(f"  Pipeline didn't reach sign_required. Check events above.")

    # ── FINALIZE TEST (frontend gen with fake app ID) ──────────────────────
    if build_id:
        print(f"\n{C.BOLD}Test frontend generation?{C.END}")
        print(f"  This will call /finalize with a fake App ID to test React generation.")
        try:
            answer = input(f"  Proceed? [Y/n]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = 'n'
        
        if answer != 'n':
            section("FINALIZE (Frontend Generation)", C.HEADER)
            fake_app_id = "999999999"
            finalize_url = f"{backend_url}/api/v1/finalize"
            finalize_body = {
                "build_id": build_id,
                "package_id": fake_app_id,
            }
            finalize_headers = dict(headers)
            finalize_headers["Accept"] = "text/event-stream"

            print(f"  Calling /finalize with fake App ID {fake_app_id}...")
            
            for event in stream_sse(finalize_url, finalize_body, finalize_headers):
                step = event.get("step", "?")
                message = event.get("message", "")

                if step == "error":
                    print(f"  {C.RED}[{step}] {message}{C.END}")
                    break
                elif step == "complete":
                    print(f"  {C.GREEN}[{step}] {message}{C.END}")
                    frontend_files = event.get("files", {})
                else:
                    print(f"  {C.DIM}[{step}]{C.END} {message}")

            if frontend_files:
                section("GENERATED FRONTEND FILES", C.GREEN)
                for path, content in sorted(frontend_files.items()):
                    lines = content.split('\n')
                    print(f"\n  {C.BOLD}{path}{C.END} ({len(lines)} lines)")
                    
                    # Show key files in full, others truncated
                    if path in ("/App.tsx", "/hooks/useX402Client.ts", "/x402-config.ts", "/hooks/useContract.ts"):
                        for i, line in enumerate(lines[:80]):
                            print(f"    {C.DIM}{i+1:3}{C.END} {line}")
                        if len(lines) > 80:
                            print(f"    {C.YELLOW}... ({len(lines) - 80} more lines){C.END}")
                    else:
                        print(f"    {C.DIM}(truncated — {len(lines)} lines){C.END}")

                # Check for x402 files
                if "/hooks/useX402Client.ts" in frontend_files:
                    print(f"\n  {C.GREEN}x402 client hook generated{C.END}")
                if "/x402-config.ts" in frontend_files:
                    print(f"  {C.GREEN}x402 config generated{C.END}")

                banner("FULL PIPELINE TEST COMPLETE", C.BOLD + C.GREEN)
            else:
                print(f"\n  {C.RED}No frontend files received from finalize.{C.END}")

    # Save raw events for debugging
    output_dir = "test_outputs"
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"test_{template_type or 'unknown'}_{timestamp}.json")
    
    save_data = {
        "prompt": prompt,
        "framework": framework,
        "model": model,
        "template_type": template_type,
        "spec": spec,
        "contract_code": contract_code,
        "arc32_methods": [m.get("name") for m in (arc32_spec or {}).get("contract", {}).get("methods", [])] if arc32_spec else [],
        "build_id": build_id,
        "event_count": len(events),
        "elapsed_s": round(elapsed, 1),
        "events": events,
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, indent=2, default=str)
    
    print(f"\n  {C.DIM}Raw events saved to: {output_file}{C.END}")


# ============================================================================
# Entry point
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description="Test AlgoVibe pipeline via HTTP")
    parser.add_argument("prompt", nargs="?", default=None, help="Generation prompt")
    parser.add_argument("--framework", "-f", default="puyats", choices=["puyats", "puyapy"])
    parser.add_argument("--network", "-n", default="testnet")
    parser.add_argument("--x402", action="store_true", help="Use default x402 test prompt")
    parser.add_argument("--key", "-k", default="", help="OpenRouter API key")
    parser.add_argument("--model", "-m", default="", help="Model name (e.g. google/gemini-2.5-flash-preview)")
    parser.add_argument("--url", "-u", default="http://localhost:8000", help="Backend URL")

    args = parser.parse_args()

    # ── Interactive config ─────────────────────────────────────────────────
    api_key = args.key
    model = args.model

    if not api_key:
        # Check env
        env_key = os.environ.get("OPENROUTER_API_KEY", "")
        if env_key:
            print(f"{C.DIM}Found OPENROUTER_API_KEY in environment.{C.END}")
            try:
                use_env = input(f"Use existing key ({env_key[:8]}...)? [Y/n]: ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                use_env = 'y'
            if use_env != 'n':
                api_key = env_key

        if not api_key:
            print(f"\n{C.BOLD}OpenRouter API Key{C.END}")
            print(f"  Get one at: https://openrouter.ai/keys")
            try:
                api_key = input(f"  Enter key: ").strip()
            except (EOFError, KeyboardInterrupt):
                api_key = ""
            if not api_key:
                print(f"{C.YELLOW}No key provided — will use server's default config.{C.END}")

    if not model:
        print(f"\n{C.BOLD}Model Selection{C.END}")
        print(f"  1. google/gemini-2.5-flash-preview    (fast, cheap)")
        print(f"  2. google/gemini-2.5-pro-preview      (best quality)")
        print(f"  3. anthropic/claude-sonnet-4           (strong coding)")
        print(f"  4. deepseek/deepseek-chat-v3-0324     (good value)")
        print(f"  5. openai/gpt-4.1-mini                (balanced)")
        
        env_model = os.environ.get("OPENROUTER_MODEL", "")
        default_model = env_model or "google/gemini-2.5-flash-preview"
        
        try:
            model_input = input(f"  Choice or model name [{default_model}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            model_input = ""
        
        model_map = {
            "1": "google/gemini-2.5-flash-preview",
            "2": "google/gemini-2.5-pro-preview",
            "3": "anthropic/claude-sonnet-4",
            "4": "deepseek/deepseek-chat-v3-0324",
            "5": "openai/gpt-4.1-mini",
        }
        
        if model_input in model_map:
            model = model_map[model_input]
        elif model_input:
            model = model_input
        else:
            model = default_model

    print(f"\n{C.GREEN}Using model: {model}{C.END}")

    # ── Prompt ─────────────────────────────────────────────────────────────
    if args.x402:
        prompt = "Build a pay-per-call weather API that charges 0.01 USDC per request using x402 on Algorand testnet"
    elif args.prompt:
        prompt = args.prompt
    else:
        print(f"\n{C.BOLD}Enter prompt{C.END} (or press Enter for default x402 test):")
        try:
            user_prompt = input("  > ").strip()
        except (EOFError, KeyboardInterrupt):
            user_prompt = ""
        if user_prompt:
            prompt = user_prompt
        else:
            prompt = "Build a pay-per-call joke API that charges 0.005 USDC per request using x402"
            print(f"  {C.DIM}Using: {prompt}{C.END}")

    # Run
    run_test(prompt, args.framework, args.network, api_key, model, args.url)


if __name__ == "__main__":
    main()
