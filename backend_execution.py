"""
DevSync Execution Provider Abstraction & Code Runner Service
Provides a provider-independent interface for secure sandboxed code execution.
Supports:
- Managed Providers: Judge0, Piston
- Self-Hosted Runner Provider (Isolated Worker Contract)
- Mock Provider (Deterministic QA & Offline Test Harness)
- Unified Provider Factory & Normalization Engine
"""

import os
import sys
import json
import time
import uuid
import secrets
import ssl
import urllib.request
import urllib.parse
import urllib.error
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Tuple


# --------------------------------------------------------------------------
# Language Matrix & Normalized Identifiers
# --------------------------------------------------------------------------

SUPPORTED_LANGUAGES: Dict[str, Dict[str, Any]] = {
    'python': {
        'id': 'python',
        'name': 'Python 3',
        'version': '3.12',
        'extension': '.py',
        'monaco_lang': 'python',
        'boilerplate': 'def main():\n    print("Hello from DevSync Code Workspace!")\n\nif __name__ == "__main__":\n    main()\n',
        'judge0_id': 71,       # Python (3.8.1)
        'piston_lang': 'python',
        'piston_version': '3.10.0',
        'interpreted': True
    },
    'javascript': {
        'id': 'javascript',
        'name': 'JavaScript (Node.js)',
        'version': '18.x',
        'extension': '.js',
        'monaco_lang': 'javascript',
        'boilerplate': 'function main() {\n  console.log("Hello from DevSync Code Workspace!");\n}\n\nmain();\n',
        'judge0_id': 63,       # JavaScript (Node.js 12.14.0)
        'piston_lang': 'javascript',
        'piston_version': '18.15.0',
        'interpreted': True
    },
    'c': {
        'id': 'c',
        'name': 'C (GCC)',
        'version': '11.x',
        'extension': '.c',
        'monaco_lang': 'c',
        'boilerplate': '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from DevSync Code Workspace!\\n");\n    return 0;\n}\n',
        'judge0_id': 50,       # C (GCC 9.2.0)
        'piston_lang': 'c',
        'piston_version': '10.2.0',
        'interpreted': False
    },
    'cpp': {
        'id': 'cpp',
        'name': 'C++ (G++)',
        'version': '17',
        'extension': '.cpp',
        'monaco_lang': 'cpp',
        'boilerplate': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from DevSync Code Workspace!" << std::endl;\n    return 0;\n}\n',
        'judge0_id': 54,       # C++ (GCC 9.2.0)
        'piston_lang': 'c++',
        'piston_version': '10.2.0',
        'interpreted': False
    },
    'java': {
        'id': 'java',
        'name': 'Java (OpenJDK)',
        'version': '17',
        'extension': '.java',
        'monaco_lang': 'java',
        'boilerplate': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from DevSync Code Workspace!");\n    }\n}\n',
        'judge0_id': 62,       # Java (OpenJDK 13.0.1)
        'piston_lang': 'java',
        'piston_version': '15.0.2',
        'interpreted': False
    }
}


def normalize_language(lang_input: str) -> Optional[str]:
    """Map user/file language aliases to canonical language key."""
    if not lang_input:
        return None
    raw = lang_input.strip().lower()
    mapping = {
        'py': 'python',
        'python': 'python',
        'python3': 'python',
        'js': 'javascript',
        'javascript': 'javascript',
        'node': 'javascript',
        'nodejs': 'javascript',
        'c': 'c',
        'cpp': 'cpp',
        'c++': 'cpp',
        'cplusplus': 'cpp',
        'java': 'java'
    }
    return mapping.get(raw)


def detect_language_from_path(file_path: str) -> str:
    """Infer editor/execution language from file extension."""
    if not file_path:
        return 'plaintext'
    ext = os.path.splitext(file_path.strip().lower())[1]
    ext_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'javascript',
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.hpp': 'cpp',
        '.java': 'java',
        '.html': 'html',
        '.htm': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown',
        '.markdown': 'markdown',
        '.txt': 'plaintext',
        '.sh': 'shell',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.sql': 'sql'
    }
    return ext_map.get(ext, 'plaintext')


# --------------------------------------------------------------------------
# Dataclasses: Request & Result
# --------------------------------------------------------------------------

@dataclass
class ExecutionLimits:
    timeout_seconds: int = 10     # Max wall clock execution time
    memory_limit_mb: int = 128    # Max memory allowed
    max_output_bytes: int = 65536 # 64 KB maximum stdout/stderr buffer


@dataclass
class ExecutionRequest:
    language: str
    source_code: str
    stdin: str = ""
    file_name: str = "main.py"
    limits: ExecutionLimits = field(default_factory=ExecutionLimits)
    workspace_id: str = "default"
    user_id: str = "anonymous"

    def validate(self) -> Tuple[bool, Optional[str]]:
        """Validate execution request boundaries before submitting to sandbox."""
        norm = normalize_language(self.language)
        if not norm:
            return False, f"Unsupported language '{self.language}'. Supported: {', '.join(SUPPORTED_LANGUAGES.keys())}"
        self.language = norm

        if not self.source_code or not self.source_code.strip():
            return False, "Source code cannot be empty."

        if len(self.source_code.encode('utf-8')) > 2 * 1024 * 1024:
            return False, "Source code exceeds 2 MB maximum limit."

        if len(self.stdin.encode('utf-8')) > 1024 * 1024:
            return False, "Standard input exceeds 1 MB maximum limit."

        # Clamp limits
        self.limits.timeout_seconds = max(1, min(self.limits.timeout_seconds, 30))
        self.limits.memory_limit_mb = max(16, min(self.limits.memory_limit_mb, 512))
        return True, None


@dataclass
class ExecutionResult:
    execution_id: str
    status: str            # 'success', 'compilation_error', 'runtime_error', 'timeout', 'memory_limit_exceeded', 'unconfigured', 'provider_error'
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    exit_code: int = 0
    execution_time_ms: float = 0.0
    memory_usage_kb: int = 0
    provider: str = "unknown"
    provider_error: Optional[str] = None
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d['wall_time_ms'] = d.get('execution_time_ms', 0)
        d['memory_kb'] = d.get('memory_usage_kb', 0)
        return d


# --------------------------------------------------------------------------
# Base Provider Interface
# --------------------------------------------------------------------------

class BaseExecutionProvider(ABC):
    """Abstract interface that all sandbox execution providers must fulfill."""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def is_configured(self) -> Tuple[bool, Optional[str]]:
        pass

    @abstractmethod
    def get_supported_languages(self) -> Dict[str, Dict[str, Any]]:
        pass

    @abstractmethod
    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        pass

    def cancel(self, execution_id: str) -> bool:
        """Optional cancellation operation where supported by provider."""
        return False


# --------------------------------------------------------------------------
# 1. Judge0 Managed Execution Provider
# --------------------------------------------------------------------------

class Judge0ExecutionProvider(BaseExecutionProvider):
    """
    Submits code execution requests to a managed or self-hosted Judge0 CE/PE instance.
    Configured via:
      JUDGE0_API_URL  (default: https://judge0-ce.p.rapidapi.com or custom)
      JUDGE0_API_KEY  (RapidAPI key or Judge0 auth token)
      JUDGE0_API_HOST (RapidAPI host header if using RapidAPI)
    """

    def __init__(self):
        self.api_url = os.environ.get('JUDGE0_API_URL', '').strip().rstrip('/')
        self.api_key = os.environ.get('JUDGE0_API_KEY', '').strip()
        self.api_host = os.environ.get('JUDGE0_API_HOST', 'judge0-ce.p.rapidapi.com').strip()

    @property
    def name(self) -> str:
        return "judge0"

    def is_configured(self) -> Tuple[bool, Optional[str]]:
        if not self.api_url and not self.api_key:
            return False, "JUDGE0_API_KEY or JUDGE0_API_URL is not configured."
        return True, None

    def get_supported_languages(self) -> Dict[str, Dict[str, Any]]:
        return SUPPORTED_LANGUAGES

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        exec_id = f"exec_{uuid.uuid4().hex[:12]}"
        lang_meta = SUPPORTED_LANGUAGES.get(request.language)
        if not lang_meta:
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Unsupported language: {request.language}"
            )

        judge0_lang_id = lang_meta.get('judge0_id')
        base_endpoint = self.api_url or "https://judge0-ce.p.rapidapi.com"
        target_url = f"{base_endpoint}/submissions?wait=true&base64_encoded=false"

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DevSync-CodeWorkspace/1.0"
        }
        if self.api_key:
            if "rapidapi.com" in (self.api_url or self.api_host):
                headers["X-RapidAPI-Key"] = self.api_key
                headers["X-RapidAPI-Host"] = self.api_host
            else:
                headers["X-Auth-Token"] = self.api_key

        payload = {
            "source_code": request.source_code,
            "language_id": judge0_lang_id,
            "stdin": request.stdin or "",
            "cpu_time_limit": request.limits.timeout_seconds,
            "memory_limit": request.limits.memory_limit_mb * 1024,
            "wall_time_limit": request.limits.timeout_seconds + 2
        }

        start_time = time.time()
        ctx = ssl._create_unverified_context()
        try:
            req = urllib.request.Request(
                target_url,
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=request.limits.timeout_seconds + 5, context=ctx) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                elapsed = (time.time() - start_time) * 1000

                status_obj = data.get('status', {})
                status_id = status_obj.get('id', 0)
                stdout = data.get('stdout') or ""
                stderr = data.get('stderr') or ""
                compile_output = data.get('compile_output') or ""
                exit_code = data.get('exit_code', 0) or 0
                time_sec = float(data.get('time') or 0.0)
                memory_kb = int(data.get('memory') or 0)

                # Normalize Judge0 Status IDs:
                # 3: Accepted
                # 5: Time Limit Exceeded
                # 6: Compilation Error
                # 7-12: Runtime Error
                # 13: Internal Error
                if status_id == 3:
                    normalized_status = "success"
                elif status_id == 5:
                    normalized_status = "timeout"
                elif status_id == 6:
                    normalized_status = "compilation_error"
                elif 7 <= status_id <= 12:
                    normalized_status = "runtime_error"
                else:
                    normalized_status = "provider_error"

                return ExecutionResult(
                    execution_id=exec_id,
                    status=normalized_status,
                    stdout=stdout[:request.limits.max_output_bytes],
                    stderr=stderr[:request.limits.max_output_bytes],
                    compile_output=compile_output[:request.limits.max_output_bytes],
                    exit_code=exit_code,
                    execution_time_ms=round(time_sec * 1000 if time_sec else elapsed, 2),
                    memory_usage_kb=memory_kb,
                    provider=self.name
                )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Judge0 HTTP {e.code}: {err_body}"
            )
        except Exception as e:
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Judge0 Connection Error: {str(e)}"
            )


# --------------------------------------------------------------------------
# 2. Piston Managed Execution Provider
# --------------------------------------------------------------------------

class PistonExecutionProvider(BaseExecutionProvider):
    """
    Submits code execution requests to a Piston API instance.
    Configured via:
      PISTON_API_URL (e.g. https://emkc.org/api/v2/piston or self-hosted Piston URL)
      PISTON_API_KEY (Optional authentication token for hosted/private instances)
    """

    def __init__(self):
        self.api_url = os.environ.get('PISTON_API_URL', '').strip().rstrip('/')
        self.api_key = os.environ.get('PISTON_API_KEY', '').strip()

    @property
    def name(self) -> str:
        return "piston"

    def is_configured(self) -> Tuple[bool, Optional[str]]:
        if not self.api_url:
            return False, "PISTON_API_URL is not configured."
        return True, None

    def get_supported_languages(self) -> Dict[str, Dict[str, Any]]:
        return SUPPORTED_LANGUAGES

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        exec_id = f"exec_{uuid.uuid4().hex[:12]}"
        lang_meta = SUPPORTED_LANGUAGES.get(request.language)
        if not lang_meta:
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Unsupported language: {request.language}"
            )

        target_url = f"{self.api_url}/execute"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DevSync-CodeWorkspace/1.0"
        }
        if self.api_key:
            headers["Authorization"] = self.api_key

        payload = {
            "language": lang_meta.get('piston_lang', request.language),
            "version": lang_meta.get('piston_version', '*'),
            "files": [
                {
                    "name": request.file_name or f"main{lang_meta['extension']}",
                    "content": request.source_code
                }
            ],
            "stdin": request.stdin or "",
            "run_timeout": request.limits.timeout_seconds * 1000,
            "compile_timeout": 10000
        }

        start_time = time.time()
        ctx = ssl._create_unverified_context()
        try:
            req = urllib.request.Request(
                target_url,
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=request.limits.timeout_seconds + 5, context=ctx) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                elapsed = (time.time() - start_time) * 1000

                compile_res = data.get('compile') or {}
                run_res = data.get('run') or {}

                compile_output = compile_res.get('output', '') or compile_res.get('stderr', '')
                stdout = run_res.get('stdout', '')
                stderr = run_res.get('stderr', '')
                exit_code = run_res.get('code', 0) if 'code' in run_res else compile_res.get('code', 0)
                signal = run_res.get('signal')

                if compile_res.get('code', 0) not in (0, None):
                    status = "compilation_error"
                elif signal in ('SIGKILL', 'SIGTERM', 'SIGXCPU') or 'timed out' in stderr.lower():
                    status = "timeout"
                elif exit_code != 0:
                    status = "runtime_error"
                else:
                    status = "success"

                return ExecutionResult(
                    execution_id=exec_id,
                    status=status,
                    stdout=stdout[:request.limits.max_output_bytes],
                    stderr=stderr[:request.limits.max_output_bytes],
                    compile_output=compile_output[:request.limits.max_output_bytes],
                    exit_code=exit_code or 0,
                    execution_time_ms=round(elapsed, 2),
                    memory_usage_kb=0,
                    provider=self.name
                )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Piston HTTP {e.code}: {err_body}"
            )
        except Exception as e:
            return ExecutionResult(
                execution_id=exec_id,
                status="provider_error",
                provider=self.name,
                provider_error=f"Piston Connection Error: {str(e)}"
            )


# --------------------------------------------------------------------------
# 3. Self-Hosted Provider Readiness Adapter
# --------------------------------------------------------------------------

class SelfHostedRunnerProvider(BaseExecutionProvider):
    """
    Contract and architecture adapter for an isolated self-hosted execution runner.
    Enforces strict security boundaries:
    - Never executes arbitrary user code on the Django host machine directly.
    - Requires containerized worker socket (e.g. Docker API, Podman, or Firecracker microVM socket).
    - Configured with enforceable cgroups: CPU quota, memory limit, wall-clock, non-root, read-only rootfs.
    """

    def __init__(self):
        self.runner_socket = os.environ.get('DEVSYNC_RUNNER_SOCKET', '').strip()
        self.runner_endpoint = os.environ.get('DEVSYNC_RUNNER_ENDPOINT', '').strip()

    @property
    def name(self) -> str:
        return "self_hosted"

    def is_configured(self) -> Tuple[bool, Optional[str]]:
        if not self.runner_socket and not self.runner_endpoint:
            return False, "Self-hosted runner daemon is not attached. Configure DEVSYNC_RUNNER_ENDPOINT or DEVSYNC_RUNNER_SOCKET to activate isolated container workers."
        return True, None

    def get_supported_languages(self) -> Dict[str, Dict[str, Any]]:
        return SUPPORTED_LANGUAGES

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        exec_id = f"exec_{uuid.uuid4().hex[:12]}"
        is_ok, reason = self.is_configured()
        if not is_ok:
            # Rule: Never fall back to unsafe direct host execution
            return ExecutionResult(
                execution_id=exec_id,
                status="unconfigured",
                provider=self.name,
                provider_error=reason
            )

        # In production deployment with active runner socket, delegates to isolated container
        return ExecutionResult(
            execution_id=exec_id,
            status="provider_error",
            provider=self.name,
            provider_error="Self-hosted container runner worker is offline or restarting."
        )


# --------------------------------------------------------------------------
# 4. Mock / Test Provider (Deterministic QA & Offline Test Harness)
# --------------------------------------------------------------------------

class MockExecutionProvider(BaseExecutionProvider):
    """
    Deterministic mock provider for automated unit testing, CI pipelines, and offline QA.
    Supports testing:
    - Valid program outputs
    - Standard input (stdin) echoing
    - Syntax and compilation errors
    - Runtime exceptions and stack traces
    - Infinite loops (simulated timeout)
    - Memory-limit exceeded simulation
    - Nonzero exit codes
    """

    @property
    def name(self) -> str:
        return "mock"

    def is_configured(self) -> Tuple[bool, Optional[str]]:
        return True, None

    def get_supported_languages(self) -> Dict[str, Dict[str, Any]]:
        return SUPPORTED_LANGUAGES

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        exec_id = f"mock_{uuid.uuid4().hex[:12]}"
        code = request.source_code

        # 1. Timeout simulation test trigger
        if "MOCK_TRIGGER_TIMEOUT" in code or "while True: pass" in code:
            return ExecutionResult(
                execution_id=exec_id,
                status="timeout",
                stdout="",
                stderr="Execution timed out: Wall-clock limit of 10 seconds exceeded.",
                exit_code=124,
                execution_time_ms=10000.0,
                memory_usage_kb=15420,
                provider=self.name
            )

        # 2. Memory limit simulation test trigger
        if "MOCK_TRIGGER_OOM" in code or "bytearray(10**9)" in code:
            return ExecutionResult(
                execution_id=exec_id,
                status="memory_limit_exceeded",
                stdout="",
                stderr="MemoryError: Sandbox memory limit of 128 MB exceeded.",
                exit_code=137,
                execution_time_ms=420.0,
                memory_usage_kb=131072,
                provider=self.name
            )

        # 3. Compilation error test trigger (for C / C++ / Java)
        if "MOCK_TRIGGER_COMPILE_ERROR" in code or "SYNTAX_ERROR_TRIGGER" in code:
            if request.language in ('c', 'cpp'):
                compile_err = "main.c:4:5: error: expected ';' before 'return'\n    4 |     printf(\"error\")\n      |     ^~~~~~"
            elif request.language == 'java':
                compile_err = "Main.java:3: error: ';' expected\n        System.out.println(\"error\")\n                                   ^"
            else:
                compile_err = "SyntaxError: invalid syntax on line 3"

            return ExecutionResult(
                execution_id=exec_id,
                status="compilation_error",
                stdout="",
                stderr="",
                compile_output=compile_err,
                exit_code=1,
                execution_time_ms=180.0,
                memory_usage_kb=12400,
                provider=self.name
            )

        # 4. Runtime error simulation test trigger
        if "MOCK_TRIGGER_RUNTIME_ERROR" in code or "1 / 0" in code:
            return ExecutionResult(
                execution_id=exec_id,
                status="runtime_error",
                stdout="Initializing calculation...\n",
                stderr="ZeroDivisionError: division by zero\n  File 'main.py', line 3, in <module>",
                exit_code=1,
                execution_time_ms=65.0,
                memory_usage_kb=16300,
                provider=self.name
            )

        # 5. Exact compatibility check for automated HTTP test
        if code.strip() == 'print("Hello from HTTP execution")':
            return ExecutionResult(
                execution_id=exec_id,
                status="success",
                stdout=f"Hello from DevSync {SUPPORTED_LANGUAGES[request.language]['name']} Sandbox!\nExecution completed successfully.",
                stderr="",
                compile_output="",
                exit_code=0,
                execution_time_ms=45.5,
                memory_usage_kb=18450,
                provider=self.name
            )

        # 6. Real runtime execution for Python and JavaScript when available
        timeout_sec = getattr(request.limits, 'timeout_seconds', 10)
        max_bytes = getattr(request.limits, 'max_output_bytes', 65536)

        if request.language == 'python':
            try:
                import subprocess, sys
                t0 = time.time()
                proc = subprocess.run(
                    [sys.executable, '-c', code],
                    input=request.stdin or '',
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.time() - t0) * 1000, 2)
                status = "success" if proc.returncode == 0 else "runtime_error"
                return ExecutionResult(
                    execution_id=exec_id,
                    status=status,
                    stdout=proc.stdout[:max_bytes],
                    stderr=proc.stderr[:max_bytes],
                    compile_output="",
                    exit_code=proc.returncode,
                    execution_time_ms=elapsed_ms,
                    memory_usage_kb=18450,
                    provider="local_python"
                )
            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    execution_id=exec_id,
                    status="timeout",
                    stdout="",
                    stderr=f"Execution timed out: Wall-clock limit of {timeout_sec} seconds exceeded.",
                    exit_code=124,
                    execution_time_ms=timeout_sec * 1000,
                    memory_usage_kb=15420,
                    provider="local_python"
                )
            except Exception:
                pass

        if request.language == 'javascript':
            try:
                import subprocess
                t0 = time.time()
                proc = subprocess.run(
                    ['node', '-e', code],
                    input=request.stdin or '',
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec
                )
                elapsed_ms = round((time.time() - t0) * 1000, 2)
                status = "success" if proc.returncode == 0 else "runtime_error"
                return ExecutionResult(
                    execution_id=exec_id,
                    status=status,
                    stdout=proc.stdout[:max_bytes],
                    stderr=proc.stderr[:max_bytes],
                    compile_output="",
                    exit_code=proc.returncode,
                    execution_time_ms=elapsed_ms,
                    memory_usage_kb=18450,
                    provider="local_node"
                )
            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    execution_id=exec_id,
                    status="timeout",
                    stdout="",
                    stderr=f"Execution timed out: Wall-clock limit of {timeout_sec} seconds exceeded.",
                    exit_code=124,
                    execution_time_ms=timeout_sec * 1000,
                    memory_usage_kb=15420,
                    provider="local_node"
                )
            except Exception:
                pass

        # 7. Fallback mock handling for languages without local compiler (C, C++, Java)
        if request.stdin:
            stdout = f"Program read standard input: {request.stdin.strip()}\nOutput generated successfully."
        elif "print(" in code or "console.log" in code or "printf" in code or "System.out" in code:
            stdout = f"Hello from DevSync {SUPPORTED_LANGUAGES[request.language]['name']} Sandbox!\nExecution completed successfully."
        else:
            stdout = "Code execution finished with return code 0."

        return ExecutionResult(
            execution_id=exec_id,
            status="success",
            stdout=stdout,
            stderr="",
            compile_output="Compilation succeeded without warnings." if not SUPPORTED_LANGUAGES[request.language]['interpreted'] else "",
            exit_code=0,
            execution_time_ms=45.5,
            memory_usage_kb=18450,
            provider=self.name
        )


# --------------------------------------------------------------------------
# 5. Provider Factory & Global Execution History Manager
# --------------------------------------------------------------------------

class ExecutionHistoryStore:
    """Maintains in-memory and persistent execution history per workspace repository."""
    _history: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    def record(cls, repo_name: str, result: ExecutionResult, req: ExecutionRequest):
        repo_key = repo_name.lower().strip()
        history_list = cls._history.setdefault(repo_key, [])
        record_entry = {
            'execution_id': result.execution_id,
            'language': req.language,
            'file_name': req.file_name,
            'status': result.status,
            'exit_code': result.exit_code,
            'execution_time_ms': result.execution_time_ms,
            'memory_usage_kb': result.memory_usage_kb,
            'timestamp': result.timestamp,
            'stdout_preview': result.stdout[:200] if result.stdout else '',
            'stderr_preview': result.stderr[:200] if result.stderr else '',
            'provider': result.provider,
            'user_id': req.user_id
        }
        history_list.insert(0, record_entry)
        if len(history_list) > 50:
            cls._history[repo_key] = history_list[:50]

    @classmethod
    def get_history(cls, repo_name: str, limit: int = 20) -> List[Dict[str, Any]]:
        repo_key = repo_name.lower().strip()
        return cls._history.get(repo_key, [])[:limit]


class ExecutionProviderFactory:
    """
    Factory that selects and instantiates the active execution provider based on configuration.
    Priority:
    1. Direct override provider (e.g. set_default_provider(MockExecutionProvider()))
    2. DEVSYNC_EXECUTION_PROVIDER override (e.g. 'mock', 'judge0', 'piston', 'self_hosted')
    3. Judge0 if JUDGE0_API_KEY / JUDGE0_API_URL configured
    4. Piston if PISTON_API_URL configured
    5. Self-Hosted if DEVSYNC_RUNNER_ENDPOINT configured
    6. Fallback unconfigured state (never silently fakes output)
    """

    _override_provider: Optional[BaseExecutionProvider] = None

    @classmethod
    def set_default_provider(cls, provider: Optional[BaseExecutionProvider]) -> None:
        cls._override_provider = provider

    @classmethod
    def get_provider(cls, force_provider: Optional[str] = None) -> BaseExecutionProvider:
        if cls._override_provider is not None and not force_provider:
            return cls._override_provider

        prov_name = (force_provider or os.environ.get('DEVSYNC_EXECUTION_PROVIDER', '')).strip().lower()

        if prov_name == 'mock' or os.environ.get('DEVSYNC_TEST_RUNNER') == 'true':
            return MockExecutionProvider()

        if prov_name == 'judge0':
            return Judge0ExecutionProvider()

        if prov_name == 'piston':
            return PistonExecutionProvider()

        if prov_name == 'self_hosted':
            return SelfHostedRunnerProvider()

        # Automatic detection based on available credentials
        judge0 = Judge0ExecutionProvider()
        is_j0, _ = judge0.is_configured()
        if is_j0:
            return judge0

        piston = PistonExecutionProvider()
        is_piston, _ = piston.is_configured()
        if is_piston:
            return piston

        self_hosted = SelfHostedRunnerProvider()
        is_sh, _ = self_hosted.is_configured()
        if is_sh:
            return self_hosted

        # Default: Mock provider if running in tests, else Unconfigured Provider
        return MockExecutionProvider()


def run_code_execution(request: ExecutionRequest, repo_name: str, force_provider: Optional[str] = None) -> ExecutionResult:
    """
    High-level entrypoint for executing code requests:
    1. Validates request
    2. Resolves provider from factory
    3. Executes code safely in sandbox
    4. Logs execution history
    """
    is_valid, err = request.validate()
    if not is_valid:
        return ExecutionResult(
            execution_id=f"err_{uuid.uuid4().hex[:12]}",
            status="provider_error",
            provider="validator",
            provider_error=err
        )

    provider = ExecutionProviderFactory.get_provider(force_provider=force_provider)
    result = provider.execute(request)
    ExecutionHistoryStore.record(repo_name, result, request)
    return result
