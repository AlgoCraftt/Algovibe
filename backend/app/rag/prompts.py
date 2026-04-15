"""
Prompt Templates with RAG Context

Formats prompts to include retrieved documentation context.
"""


def format_algorand_prompt(
    base_prompt: str,
    template_code: str,
    spec: dict,
    docs_context: list[str],
) -> str:
    """
    Format prompt for Algorand contract generation with documentation context.

    Args:
        base_prompt: Base instruction prompt
        template_code: The template code to customize
        spec: Contract specification
        docs_context: Retrieved Algorand/PuyaPy documentation

    Returns:
        Formatted prompt string
    """

    docs_section = format_docs_context(docs_context, "Algorand/PuyaPy")

    return f"""{base_prompt}

## Template Code
```python
{template_code}
```

## Specification
- Name: {spec.get('name', 'MyContract')}
- Description: {spec.get('description', 'An Algorand smart contract')}
- Functions: {', '.join(spec.get('functions', []))}
- Parameters: {spec.get('parameters', {})}

{docs_section}

Generate the customized contract code:"""


def format_react_prompt(
    base_prompt: str,
    package_id: str,
    spec: dict,
    docs_context: list[str],
) -> str:
    """
    Format prompt for React code generation with documentation context.

    Args:
        base_prompt: Base instruction prompt
        package_id: Deployed Algorand app ID
        spec: Contract specification
        docs_context: Retrieved Algorand SDK documentation

    Returns:
        Formatted prompt string
    """

    docs_section = format_docs_context(docs_context, "Algorand SDK")

    return f"""{base_prompt}

## App ID
{package_id}

## Specification
- Name: {spec.get('name', 'MyDApp')}
- Description: {spec.get('description', 'An Algorand DApp')}
- Functions: {', '.join(spec.get('functions', []))}
- UI Requirements: {', '.join(spec.get('ui_requirements', []))}

{docs_section}

Generate the React frontend code:"""


def format_docs_context(docs: list[str], doc_type: str = "Documentation") -> str:
    """
    Format documentation chunks for inclusion in prompt.

    Args:
        docs: List of documentation strings
        doc_type: Type label for the documentation

    Returns:
        Formatted documentation section
    """

    if not docs:
        return f"## {doc_type} Reference\nNo additional documentation available."

    # Limit total context size
    max_chars = 4000
    selected_docs = []
    current_chars = 0

    for doc in docs:
        if current_chars + len(doc) > max_chars:
            break
        selected_docs.append(doc)
        current_chars += len(doc)

    docs_text = "\n\n---\n\n".join(selected_docs)

    return f"""## {doc_type} Reference

Use the following documentation as reference. Follow these patterns and best practices:

{docs_text}"""


def format_analysis_prompt(user_prompt: str) -> str:
    """
    Format prompt for the architect agent to analyze user intent.

    Args:
        user_prompt: The user's natural language request

    Returns:
        Formatted analysis prompt
    """

    return f"""Analyze the following DApp request and determine:
1. Which template category best fits
2. What customizations are needed
3. Key functions and parameters

Available categories:
- token_vault: For managing token deposits and withdrawals
- crowdfunding: For campaigns with funding goals, deadlines, and withdrawals
- nft: For creating and managing NFT collections
- voting: For on-chain voting and governance
- escrow: For escrowed payments between parties
- marketplace: For buying/selling items
- counter: For simple state management demos
- token: For custom fungible token creation
- custom: For anything else

User request: {user_prompt}

Respond with a JSON object:
{{
  "template_type": "category_name",
  "spec": {{
    "name": "contract name",
    "description": "brief description",
    "functions": ["list of functions"],
    "parameters": {{ "key": "value" }},
    "ui_requirements": ["list of UI elements"]
  }}
}}"""
