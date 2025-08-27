import os
import json
import asyncio
from typing import Optional, Dict, Any

import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import AzureChatCompletion, AzureChatPromptExecutionSettings
from semantic_kernel.contents import ChatHistory

# Try loading a .env file (optional)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except ImportError:
    pass

# -------------------------------
# Configuration (use env vars)
# -------------------------------

DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT", os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"))
ENDPOINT        = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("OPENAI_ENDPOINT")
API_KEY         = os.getenv("AZURE_OPENAI_KEY") or os.getenv("OPENAI_API_KEY")

# Validate required config early (prevents DefaultAzureCredential fallback confusion)
if not ENDPOINT or not API_KEY:
    raise SystemExit(
        "Missing Azure OpenAI configuration.\n"
        "Required env vars:\n"
        "  AZURE_OPENAI_ENDPOINT (e.g. https://<resource>.openai.azure.com/)\n"
        "  AZURE_OPENAI_KEY\n"
        "Optional:\n"
        "  AZURE_OPENAI_DEPLOYMENT (default: gpt-4o)\n"
        "Tip: create a .env file with these values."
    )

# -------------------------------
# Kernel & Service
# -------------------------------
kernel = sk.Kernel()
chat_service = AzureChatCompletion(
    service_id="chat",
    deployment_name=DEPLOYMENT_NAME,
    endpoint=ENDPOINT,
    api_key=API_KEY,
)
kernel.add_service(chat_service)

# Tip: If your SDK supports JSON mode, set it here. Otherwise rely on prompting.
CHAT_SETTINGS = AzureChatPromptExecutionSettings(
    temperature=0.3,
    # response_format={"type": "json_object"},  # enable if available in your SK version
)

# -------------------------------
# Agent Definitions
# -------------------------------
BUG_HUNTER_SYS = """
You are Agent1 (Bug Hunter).
Task: Given error logs, test failures, and optionally code snippets, determine if there is a bug.
Return ONLY compact JSON with fields:
{
  "bug_detected": true|false,
  "summary": "<one-line summary>",
  "file_path": "<path if known or empty>",
  "lines": "<line range or empty>",
  "root_cause": "<brief root cause>",
  "confidence": 0.0-1.0
}
No commentary outside JSON.
"""

AUTO_FIXER_SYS = """
You are Agent2 (Auto-Fix). You propose safe, minimal changes to fix the detected bug.
Return ONLY JSON with fields:
{
  "intent": "fix_bug",
  "file_path": "<path to file to write>",
  "new_content": "<FULL updated file content after fix>",
  "explanation": "<what you changed and why>",
  "test_suggestions": ["<short test name or step>", "..."]
}
No commentary outside JSON.
"""

class Agent:
    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.history = ChatHistory()
        self.history.add_system_message(system_prompt)

    async def ask_json(self, prompt: str) -> Dict[str, Any]:
        """Send a user prompt, expect STRICT JSON in reply."""
        self.history.add_user_message(prompt)
        response = await chat_service.get_chat_message_content(
            chat_history=self.history,
            settings=CHAT_SETTINGS
        )
        text = (response.content or "").strip()
        # Keep assistant turn in memory
        self.history.add_assistant_message(text)
        # Parse JSON robustly (strip code fences if any)
        text = text.strip()
        if text.startswith("```"):
            # remove code fences like ```json ... ```
            text = text.strip("`")
            # naive fence removal
            text = text[text.find("\n")+1:]
            if text.endswith("```"):
                text = text[:-3]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Fallback: best-effort extraction of JSON substring
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(text[start:end+1])
            raise

BugHunter = Agent("Agent1-BugHunter", BUG_HUNTER_SYS)
AutoFixer  = Agent("Agent2-AutoFixer",  AUTO_FIXER_SYS)

# -------------------------------
# Orchestration
# -------------------------------
async def analyze_and_autofix(
    error_context: str,
    code_snippet: Optional[str] = None,
    file_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    1) Agent1 evaluates if there's a bug.
    2) If bug_detected = true, Agent2 proposes a fix.
    3) (Optional) Apply and test hooks.
    """
    # 1) Agent1
    hunter_prompt = f"""
You will receive diagnostic inputs:

=== ERROR/TEST CONTEXT ===
{error_context}

=== CODE (optional) ===
{code_snippet or "(none)"}

=== FILE PATH HINT (optional) ===
{file_path or "(unknown)"}
"""
    detection = await BugHunter.ask_json(hunter_prompt)

    if not detection.get("bug_detected"):
        return {"stage": "detected", "detection": detection, "message": "No bug detected by Agent1."}

    # 2) Agent2
    fixer_prompt = f"""
Detection JSON from Agent1:
{json.dumps(detection, ensure_ascii=False)}

Relevant code (if any):
{code_snippet or "(none)"}

Constraints:
- Produce minimal, safe changes.
- Return FULL file content in 'new_content' (not a diff).
- Keep the module API unchanged unless the root cause requires it.
"""
    fix = await AutoFixer.ask_json(fixer_prompt)



    return {
        "stage": "fixed",
        "detection": detection,
        "fix": fix,
        # "apply_result": apply_result,
        # "test_result": test_result
    }

async def main():
    # Example failing test + snippet
    error_context = """pytest::test_total FAILED
E   AssertionError: expected 42, got 41
Traceback:
  file app/math_utils.py, line 18, in total
"""
    code_snippet = """# file: app/math_utils.py
def total(items):
    s = 0
    for i in items:
        s -= i  # BUG: should add
    return s
"""
    result = await analyze_and_autofix(error_context, code_snippet, file_path="app/math_utils.py")
    print("== Agent1 Detection ==")
    print(json.dumps(result["detection"], indent=2))
    if result["stage"] == "fixed":
        print("\n== Agent2 Proposed Fix ==")
        print(json.dumps({
            "file_path": result["fix"].get("file_path"),
            "explanation": result["fix"].get("explanation"),
        }, indent=2))
        # Show a preview of new content (first 30 lines)
        print("\n--- new_content (preview) ---")
        content = result["fix"].get("new_content", "")
        preview = "\n".join(content.splitlines()[:30])
        print(preview)

if __name__ == "__main__":
    asyncio.run(main())
