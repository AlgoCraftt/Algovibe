"""
AlgoVibe Wiring Analyzer
=========================
Runs the generation pipeline and then analyzes how the frontend hooks
call into the smart contract. Shows the complete call graph:

  UI (App.tsx) → useContract hook → callMethod/readState → contract ABI methods

Skips the noise (TEAL dumps, base64 blobs, deployment scripts) and focuses on:
  1. Contract methods (name, args, returns)
  2. Generated useContract hook method bindings
  3. App.tsx → hook call sites
  4. Mismatches / dead wires (methods generated but never called, or called but not in ABI)

Usage:
    python test_pipeline_wiring.py
    python test_pipeline_wiring.py "Build a voting app"
    python test_pipeline_wiring.py --aicredits --key sk-... --model gemini-3-flash-preview
    python test_pipeline_wiring.py --from-file test_outputs/test_x402_service_20260603_183841.json

Requirements:
    - Backend running (unless --from-file is used)
"""

import sys
import json
import re
import time
import argparse
import os
from datetime import datetime

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
    MAGENTA = '\033[35m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    END = '\033[0m'

if sys.platform == 'win32':
    try:
        os.system('')
    except:
        pass


def banner(text, color=C.HEADER):
    w = 70
    print(f"\n{color}{'=' * w}")
    print(f"  {text}")
    print(f"{'=' * w}{C.END}\n")


def section(text, color=C.CYAN):
    print(f"\n{color}{'─' * 60}")
    print(f"  {text}")
    print(f"{'─' * 60}{C.END}")


# ============================================================================
# SSE Stream Reader (stdlib only)
# ============================================================================
def stream_sse(url, body, headers):
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
                    yield json.loads(json_str)
                except json.JSONDecodeError:
                    pass
    if buffer.strip().startswith('data: '):
        try:
            yield json.loads(buffer.strip()[6:])
        except json.JSONDecodeError:
            pass


# ============================================================================
# Wiring Analysis Logic
# ============================================================================

def parse_contract_methods(contract_code: str) -> list:
    """Extract method signatures from PuyaTS/PuyaPy contract code."""
    methods = []
    # PuyaTS: @abimethod() or public methodName(args): returnType
    # Match: public methodName(...) or @abimethod decorated methods
    pattern = r'(?:@abimethod\([^)]*\)\s*)?(?:public\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?'
    for match in re.finditer(pattern, contract_code):
        name = match.group(1)
        args_str = match.group(2).strip()
        returns = match.group(3) or 'void'
        # Skip constructor/lifecycle
        if name in ('constructor', '__init__', 'approval_program', 'clear_state_program'):
            continue
        args = []
        if args_str:
            for arg in args_str.split(','):
                arg = arg.strip()
                if ':' in arg:
                    parts = arg.split(':')
                    args.append({'name': parts[0].strip(), 'type': parts[1].strip()})
                elif arg:
                    args.append({'name': arg, 'type': 'unknown'})
        methods.append({'name': name, 'args': args, 'returns': returns})
    return methods


def parse_arc32_methods(arc32_spec: dict) -> list:
    """Extract methods from ARC32 spec."""
    if not arc32_spec:
        return []
    contract = arc32_spec.get("contract", {})
    methods = contract.get("methods", [])
    result = []
    for m in methods:
        result.append({
            'name': m.get('name', ''),
            'args': m.get('args', []),
            'returns': m.get('returns', {}).get('type', 'void') if isinstance(m.get('returns'), dict) else str(m.get('returns', 'void')),
            'desc': m.get('desc', ''),
        })
    return result


def parse_use_contract_hook(hook_code: str) -> dict:
    """Parse the generated useContract hook to find method bindings."""
    bindings = {}
    # Pattern: methodName: async (args) => callMethod({ method: 'contract_method', ...})
    pattern = r'(\w+):\s*async\s*\(([^)]*)\)\s*=>\s*\n?\s*callMethod\(\{([^}]+)\}\)'
    for match in re.finditer(pattern, hook_code):
        hook_name = match.group(1)
        hook_args = match.group(2).strip()
        call_body = match.group(3)
        # Extract the contract method name from the callMethod call
        method_match = re.search(r"method:\s*['\"]([^'\"]+)['\"]", call_body)
        contract_method = method_match.group(1) if method_match else hook_name
        # Check for payment
        has_payment = 'payment:' in call_body
        bindings[hook_name] = {
            'contract_method': contract_method,
            'hook_args': hook_args,
            'has_payment': has_payment,
        }
    # Also check for readState
    if 'readState' in hook_code:
        bindings['readState'] = {
            'contract_method': '__readState__',
            'hook_args': '',
            'has_payment': False,
        }
    return bindings


def parse_app_tsx_calls(app_code: str) -> dict:
    """Find all hook method calls in App.tsx."""
    calls = {}
    # Find destructured imports from useContract
    destructure_match = re.search(r'const\s*\{([^}]+)\}\s*=\s*useContract\(\)', app_code)
    hook_methods = []
    if destructure_match:
        hook_methods = [m.strip() for m in destructure_match.group(1).split(',')]

    # Find all function calls that match hook methods
    for method in hook_methods:
        method = method.strip()
        if not method:
            continue
        # Count occurrences (calls)
        # Pattern: method( or await method(
        call_pattern = re.compile(rf'(?:await\s+)?{re.escape(method)}\s*\(')
        occurrences = call_pattern.findall(app_code)
        # Subtract the destructuring itself
        calls[method] = {
            'call_count': len(occurrences),
            'is_used': len(occurrences) > 0,
        }

    # Also find useX402Client usage
    x402_match = re.search(r'const\s*\{([^}]+)\}\s*=\s*useX402Client\(\)', app_code)
    if x402_match:
        x402_methods = [m.strip() for m in x402_match.group(1).split(',')]
        for method in x402_methods:
            method = method.strip()
            if not method:
                continue
            call_pattern = re.compile(rf'(?:await\s+)?{re.escape(method)}\s*\(')
            occurrences = call_pattern.findall(app_code)
            calls[f'x402:{method}'] = {
                'call_count': len(occurrences),
                'is_used': len(occurrences) > 0,
            }

    return calls


def to_camel(snake: str) -> str:
    """Convert snake_case to camelCase."""
    parts = snake.split('_')
    return parts[0] + ''.join(w.capitalize() for w in parts[1:])


def analyze_wiring(contract_code: str, arc32_spec: dict, frontend_files: dict):
    """Main wiring analysis — prints the full call graph and mismatches."""

    banner("WIRING ANALYSIS", C.BOLD + C.MAGENTA)

    # 1. Contract methods (from ARC32 if available, fallback to code parsing)
    section("1. SMART CONTRACT METHODS (ABI)", C.GREEN)
    arc32_methods = parse_arc32_methods(arc32_spec)
    code_methods = parse_contract_methods(contract_code)

    methods_to_show = arc32_methods if arc32_methods else code_methods
    lifecycle = {'createApplication', 'create_application', 'optInToApplication', 'opt_in'}

    callable_methods = []
    for m in methods_to_show:
        is_lifecycle = m['name'] in lifecycle
        tag = f"{C.DIM}[lifecycle]{C.END}" if is_lifecycle else ""
        args_str = ', '.join(
            f"{a.get('name','?')}: {a.get('type','?')}" for a in m.get('args', [])
        )
        returns = m.get('returns', 'void')
        print(f"  {C.GREEN}●{C.END} {C.BOLD}{m['name']}{C.END}({args_str}) → {returns} {tag}")
        if m.get('desc'):
            print(f"    {C.DIM}{m['desc'][:80]}{C.END}")
        if not is_lifecycle:
            callable_methods.append(m['name'])
    print(f"\n  {C.BOLD}Total:{C.END} {len(methods_to_show)} methods ({len(callable_methods)} callable)")

    # 2. useContract hook bindings
    hook_code = frontend_files.get("/hooks/useContract.ts", "")
    section("2. useContract HOOK BINDINGS", C.CYAN)
    if not hook_code:
        print(f"  {C.RED}No useContract.ts found in frontend files{C.END}")
        hook_bindings = {}
    else:
        hook_bindings = parse_use_contract_hook(hook_code)
        for hook_name, info in hook_bindings.items():
            if hook_name == 'readState':
                print(f"  {C.CYAN}●{C.END} readState() → reads on-chain global/local state")
                continue
            arrow = "→"
            payment_tag = f" {C.YELLOW}[+payment]{C.END}" if info['has_payment'] else ""
            print(f"  {C.CYAN}●{C.END} {C.BOLD}{hook_name}{C.END}({info['hook_args']}) {arrow} contract.{info['contract_method']}(){payment_tag}")

    # 3. App.tsx call sites
    app_code = frontend_files.get("/App.tsx", "")
    section("3. App.tsx CALL SITES", C.BLUE)
    if not app_code:
        print(f"  {C.RED}No App.tsx found in frontend files{C.END}")
        app_calls = {}
    else:
        app_calls = parse_app_tsx_calls(app_code)
        for method, info in app_calls.items():
            status = f"{C.GREEN}✓ called{C.END}" if info['is_used'] else f"{C.YELLOW}⚠ imported but never called{C.END}"
            count_str = f"({info['call_count']}x)" if info['call_count'] > 1 else ""
            print(f"  {C.BLUE}●{C.END} {method} {count_str} {status}")

    # 4. x402 hook (if present)
    x402_hook = frontend_files.get("/hooks/useX402Client.ts", "")
    if x402_hook:
        section("4. x402 CLIENT HOOK", C.MAGENTA)
        # Check what it calls
        x402_calls_contract = re.findall(r"callMethod\(\{[^}]*method:\s*['\"]([^'\"]+)['\"]", x402_hook)
        if x402_calls_contract:
            for method_name in x402_calls_contract:
                print(f"  {C.MAGENTA}●{C.END} useX402Client → callMethod('{method_name}') + payment")
        else:
            print(f"  {C.DIM}  (x402 hook present but no direct callMethod calls found){C.END}")

        # Check x402 config
        x402_config = frontend_files.get("/x402-config.ts", "")
        if x402_config:
            price_match = re.search(r'pricePerCall["\']?\s*[:=]\s*["\']?([^"\'`,\n]+)', x402_config)
            if price_match:
                print(f"  {C.MAGENTA}●{C.END} Price per call: {price_match.group(1).strip()}")

    # 5. Wiring diagram
    section("5. FULL WIRING DIAGRAM", C.BOLD)
    print(f"  {C.DIM}App.tsx → useContract() → callMethod() → Contract ABI{C.END}")
    print()

    # Build the mapping: UI call → hook method → contract method
    for hook_name, info in hook_bindings.items():
        if hook_name == 'readState':
            continue
        contract_method = info['contract_method']
        called_in_ui = hook_name in app_calls and app_calls[hook_name]['is_used']
        ui_status = f"{C.GREEN}✓{C.END}" if called_in_ui else f"{C.RED}✗{C.END}"
        in_abi = contract_method in callable_methods
        abi_status = f"{C.GREEN}✓{C.END}" if in_abi else f"{C.RED}✗{C.END}"

        print(f"  {ui_status} UI → {C.BOLD}{hook_name}(){C.END} → {abi_status} contract.{contract_method}()")

    # 6. Mismatches
    section("6. WIRING ISSUES", C.RED)
    issues = []

    # Methods in ABI but not wired in hook
    hook_contract_methods = {info['contract_method'] for info in hook_bindings.values() if info['contract_method'] != '__readState__'}
    for method_name in callable_methods:
        camel = to_camel(method_name)
        if method_name not in hook_contract_methods and camel not in hook_bindings:
            issues.append(f"{C.YELLOW}⚠{C.END}  Contract method '{method_name}' has no hook binding (not callable from UI)")

    # Hook methods never called in UI
    for hook_name, info in hook_bindings.items():
        if hook_name in ('readState', 'loading', 'error', 'success'):
            continue
        if hook_name not in app_calls or not app_calls[hook_name]['is_used']:
            issues.append(f"{C.YELLOW}⚠{C.END}  Hook method '{hook_name}' is bound but never called in App.tsx")

    # UI calls to methods not in hook
    for method_name in app_calls:
        if method_name.startswith('x402:'):
            continue
        if method_name in ('loading', 'error', 'success', 'readState'):
            continue
        if method_name not in hook_bindings:
            issues.append(f"{C.RED}✗{C.END}  App.tsx calls '{method_name}' but it's not in useContract hook")

    if issues:
        for issue in issues:
            print(f"  {issue}")
        print(f"\n  {C.BOLD}Total issues: {len(issues)}{C.END}")
    else:
        print(f"  {C.GREEN}✓ No wiring issues detected — all paths connected{C.END}")

    # 7. Summary
    banner("WIRING SUMMARY", C.BOLD + C.GREEN if not issues else C.BOLD + C.YELLOW)
    total_contract = len(callable_methods)
    total_hooked = len([h for h in hook_bindings if h != 'readState'])
    total_called = len([m for m, info in app_calls.items()
                       if info['is_used'] and m not in ('loading', 'error', 'success', 'readState')])

    print(f"  Contract methods (callable): {total_contract}")
    print(f"  Hook bindings:               {total_hooked}")
    print(f"  UI call sites:               {total_called}")
    print(f"  Wiring issues:               {len(issues)}")

    coverage = (total_called / total_contract * 100) if total_contract > 0 else 0
    color = C.GREEN if coverage >= 80 else C.YELLOW if coverage >= 50 else C.RED
    print(f"\n  {C.BOLD}UI Coverage:{C.END} {color}{coverage:.0f}%{C.END} of contract methods reachable from UI")

    return {
        'contract_methods': callable_methods,
        'hook_bindings': hook_bindings,
        'app_calls': app_calls,
        'issues': issues,
        'coverage_pct': coverage,
    }


# ============================================================================
# Pipeline runner (minimal — only captures what we need)
# ============================================================================

def run_pipeline_for_wiring(prompt, framework, network, api_key, model, backend_url, provider):
    """Run the pipeline, capture contract + frontend, then analyze wiring."""
    banner("ALGOVIBE WIRING TEST", C.BOLD + C.GREEN)
    print(f"{C.BOLD}Prompt:{C.END}     {prompt}")
    print(f"{C.BOLD}Provider:{C.END}   {provider} / {model}")
    print(f"{C.BOLD}Backend:{C.END}    {backend_url}")

    # Health check
    try:
        health_req = Request(f"{backend_url}/health")
        health_resp = urlopen(health_req, timeout=5)
        health = json.loads(health_resp.read().decode('utf-8'))
        print(f"{C.DIM}Backend OK: {health.get('status', '?')}{C.END}")
    except Exception as e:
        print(f"{C.RED}Backend not reachable: {e}{C.END}")
        return None

    # Stream pipeline — only track what matters
    url = f"{backend_url}/api/v1/generate"
    body = {"prompt": prompt, "framework": framework, "network": network}
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
    if api_key:
        headers["X-LLM-Provider"] = provider
        headers["X-LLM-Api-Key"] = api_key
    if model:
        headers["X-LLM-Model"] = model

    print(f"\n{C.DIM}Streaming pipeline (showing progress only)...{C.END}")
    start = time.time()

    contract_code = None
    arc32_spec = None
    build_id = None
    template_type = None
    spec = None

    for event in stream_sse(url, body, headers):
        step = event.get("step", "?")
        msg = event.get("message", "")

        # Show progress dots
        if step == "error":
            print(f"  {C.RED}[ERROR] {msg}{C.END}")
            return None
        elif step in ("analyzing", "retrieving_docs", "generating_contract", "compiling", "auditing"):
            print(f"  {C.DIM}[{step}] {msg}{C.END}")
        elif step == "sign_required":
            print(f"  {C.GREEN}[ready] Contract compiled & waiting for deploy{C.END}")

        # Capture
        if step == "analyzing" and "spec" in event:
            template_type = event.get("template_type")
            spec = event.get("spec")
        if step == "compiling" and event.get("arc32_spec"):
            arc32_spec = event.get("arc32_spec")
        if step == "sign_required":
            build_id = event.get("build_id")
            contract_code = event.get("contract_code")
            arc32_spec = event.get("arc32_spec") or arc32_spec

    elapsed = time.time() - start
    print(f"\n{C.DIM}Pipeline completed in {elapsed:.1f}s{C.END}")

    if not contract_code:
        print(f"{C.RED}Pipeline didn't produce contract code.{C.END}")
        return None

    # Now call /finalize with a fake app ID to get frontend files
    if build_id:
        section("Generating frontend (finalize)...", C.DIM)
        finalize_url = f"{backend_url}/api/v1/finalize"
        finalize_body = {"build_id": build_id, "package_id": "999999"}
        finalize_headers = dict(headers)
        finalize_headers["Accept"] = "text/event-stream"

        frontend_files = {}
        for event in stream_sse(finalize_url, finalize_body, finalize_headers):
            step = event.get("step", "?")
            if step == "error":
                print(f"  {C.RED}[ERROR] {event.get('message', '')}{C.END}")
                break
            if step == "complete" and event.get("files"):
                frontend_files = event.get("files", {})
                print(f"  {C.GREEN}Got {len(frontend_files)} frontend files{C.END}")

        if frontend_files:
            analyze_wiring(contract_code, arc32_spec, frontend_files)

            # Save output
            output_dir = "test_outputs"
            os.makedirs(output_dir, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            out_file = os.path.join(output_dir, f"wiring_{template_type or 'unknown'}_{ts}.json")
            with open(out_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "prompt": prompt,
                    "template_type": template_type,
                    "contract_code": contract_code,
                    "arc32_methods": [m.get("name") for m in (arc32_spec or {}).get("contract", {}).get("methods", [])],
                    "frontend_files": frontend_files,
                }, f, indent=2, default=str)
            print(f"\n  {C.DIM}Saved to: {out_file}{C.END}")
        else:
            # No frontend — analyze just the contract + hook that would be generated
            print(f"{C.YELLOW}No frontend files from finalize. Analyzing contract only.{C.END}")
            analyze_wiring(contract_code, arc32_spec, {})
    else:
        print(f"{C.YELLOW}No build_id — can't generate frontend. Showing contract analysis only.{C.END}")
        analyze_wiring(contract_code, arc32_spec, {})


def analyze_from_file(filepath: str):
    """Load a previous test output JSON and run wiring analysis on it."""
    banner("WIRING ANALYSIS (from file)", C.BOLD + C.MAGENTA)
    print(f"{C.BOLD}File:{C.END} {filepath}")

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    contract_code = data.get("contract_code", "")
    arc32_spec = None
    frontend_files = data.get("frontend_files", {})

    # Try to find arc32 in events
    events = data.get("events", [])
    for event in events:
        if event.get("arc32_spec"):
            arc32_spec = event["arc32_spec"]
            break

    if not contract_code:
        print(f"{C.RED}No contract_code in file.{C.END}")
        return

    if not frontend_files:
        # If no frontend_files key, this was a pre-finalize run
        # Still analyze contract methods at minimum
        print(f"{C.YELLOW}No frontend_files in this output (pipeline stopped at sign_required).{C.END}")
        print(f"{C.YELLOW}Run with --finalize or use the full pipeline to get frontend wiring.{C.END}")
        print()

    analyze_wiring(contract_code, arc32_spec, frontend_files)


# ============================================================================
# Entry point
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description="Analyze AlgoVibe contract↔frontend wiring")
    parser.add_argument("prompt", nargs="?", default=None, help="Generation prompt")
    parser.add_argument("--from-file", "-F", default="", help="Analyze from a previous test output JSON")
    parser.add_argument("--framework", "-f", default="puyats", choices=["puyats", "puyapy"])
    parser.add_argument("--network", "-n", default="testnet")
    parser.add_argument("--openrouter", action="store_true", help="Use OpenRouter instead of AICredits (default)")
    parser.add_argument("--key", "-k", default="", help="API key")
    parser.add_argument("--model", "-m", default="", help="Model name")
    parser.add_argument("--url", "-u", default="http://localhost:8000", help="Backend URL")

    args = parser.parse_args()

    # Analyze from existing file
    if args.from_file:
        if not os.path.exists(args.from_file):
            print(f"{C.RED}File not found: {args.from_file}{C.END}")
            sys.exit(1)
        analyze_from_file(args.from_file)
        return

    # Live pipeline run — defaults to aicredits
    provider = "openrouter" if args.openrouter else "aicredits"
    api_key = args.key
    model = args.model

    if not api_key:
        env_var = "AICREDITS_API_KEY" if provider == "aicredits" else "OPENROUTER_API_KEY"
        api_key = os.environ.get(env_var, "")
        if api_key:
            print(f"{C.DIM}Using {env_var} from environment{C.END}")

    if not model:
        model = "gemini-3-flash-preview" if provider == "aicredits" else "google/gemini-3-flash-preview"

    prompt = args.prompt
    if not prompt:
        prompt = "Build a pay-per-call joke API that charges 0.005 ALGO per request using x402"
        print(f"{C.DIM}Using default prompt: {prompt}{C.END}")

    run_pipeline_for_wiring(prompt, args.framework, args.network, api_key, model, args.url, provider)


if __name__ == "__main__":
    main()
