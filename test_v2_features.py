import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:8000"

def request(method, path, data=None, user_header=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if user_header:
        headers["X-DevSync-User"] = user_header
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            try:
                parsed = json.loads(content)
            except Exception:
                parsed = content
            return status, parsed
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed

def run_tests():
    print("=" * 60)
    print("DEVSYNC V2 MASTER VERIFICATION TEST SUITE")
    print("=" * 60)
    passed = 0
    failed = 0

    def assert_true(cond, msg):
        nonlocal passed, failed
        if cond:
            print(f"  [PASS] {msg}")
            passed += 1
        else:
            print(f"  [FAIL] {msg}")
            failed += 1

    # --- 1. ISSUES TESTS ---
    print("\n1. Testing Issues API...")
    s, res = request("GET", "/api/v1/issues/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 5, f"GET /api/v1/issues/ returns 200 and list (got {s}, count {len(res) if isinstance(res, list) else 0})")

    s, res = request("GET", "/api/v1/issues/104/")
    assert_true(s == 200 and res.get("number") == 104, f"GET /api/v1/issues/104/ returns issue details (number: {res.get('number') if isinstance(res, dict) else None})")

    s, res = request("POST", "/api/v1/issues/104/comments/", {"text": "Verified database indices locally."})
    assert_true(s == 201 and ("comment" in res or "id" in res), "POST /api/v1/issues/104/comments/ adds comment")

    s, res = request("POST", "/api/v1/issues/104/close/", {})
    assert_true(s == 200 and res.get("status") == "Closed", "POST /api/v1/issues/104/close/ closes issue")

    s, res = request("POST", "/api/v1/issues/104/reopen/", {})
    assert_true(s == 200 and res.get("status") == "Open", "POST /api/v1/issues/104/reopen/ reopens issue")

    # --- 2. PULL REQUESTS & GIT MERGE TESTS ---
    print("\n2. Testing Pull Requests & Git Branch Merge API...")
    s, res = request("GET", "/api/v1/pull-requests/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 5, f"GET /api/v1/pull-requests/ returns 200 and list (count: {len(res) if isinstance(res, list) else 0})")

    # Create fresh PR to test end-to-end branch merge
    s, new_pr = request("POST", "/api/v1/pull-requests/", {
        "title": "Automated Test Feature Branch",
        "description": "Integration testing PR merge",
        "repository": "devsync-core",
        "sourceBranch": "feat/automated-test",
        "targetBranch": "main"
    }, user_header="balajikumar")
    assert_true(s == 201 and "number" in new_pr, f"POST /api/v1/pull-requests/ creates fresh PR (number: {new_pr.get('number')})")
    pr_num = new_pr.get("number")

    s, res = request("GET", f"/api/v1/pull-requests/{pr_num}/")
    assert_true(s == 200 and res.get("number") == pr_num, f"GET /api/v1/pull-requests/{pr_num}/ returns PR details")

    s, res = request("POST", f"/api/v1/pull-requests/{pr_num}/review/", {"action": "approve", "comment": "Architecture verified."})
    assert_true(s == 200 and ("reviews" in res or "action" in res), f"POST /api/v1/pull-requests/{pr_num}/review/ adds approval review")

    s, res = request("POST", f"/api/v1/pull-requests/{pr_num}/merge", {}, user_header="balajikumar")
    assert_true(s == 200 and res.get("status") == "Merged", f"POST /api/v1/pull-requests/{pr_num}/merge merges branch into repository (status: {res.get('status')})")

    # --- 3. TEAMS & COLLABORATOR MANAGEMENT TESTS ---
    print("\n3. Testing Teams & Collaborators API...")
    s, res = request("GET", "/api/v1/teams/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 4, f"GET /api/v1/teams/ returns project squads (count: {len(res) if isinstance(res, list) else 0})")

    s, res = request("GET", "/api/v1/teams/members/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 6, f"GET /api/v1/teams/members/ returns collaborators (count: {len(res) if isinstance(res, list) else 0})")

    s, res = request("POST", "/api/v1/teams/members/invite", {
        "project": "devsync-core",
        "name": "DevSync Test Engineer",
        "email": "test-engineer@devsync.dev",
        "role": "Fullstack Developer"
    })
    assert_true(s == 201, f"POST /api/v1/teams/members/invite sends collaborator invitation (got {s})")

    s, res = request("PATCH", "/api/v1/teams/members/naveen3438/", {
        "role": "Lead Maintainer",
        "project": "devsync-core"
    })
    assert_true(s == 200, f"PATCH /api/v1/teams/members/naveen3438/ updates member role (got {s})")

    # --- 4. CHAT, DISCUSSIONS & 24H STATUSES TESTS ---
    print("\n4. Testing DevSync Chat, Direct Messages, Reactions & Statuses API...")
    s, convs = request("GET", "/api/v1/chat/conversations")
    assert_true(s == 200 and isinstance(convs, list) and len(convs) >= 3, f"GET /api/v1/chat/conversations returns active conversations (count: {len(convs) if isinstance(convs, list) else 0})")

    target_conv_id = convs[0]["id"] if convs else "conv-direct-priya"
    s, msgs = request("GET", f"/api/v1/chat/conversations/{target_conv_id}/messages")
    assert_true(s == 200 and isinstance(msgs, list), f"GET /api/v1/chat/conversations/{target_conv_id}/messages returns message stream (count: {len(msgs) if isinstance(msgs, list) else 0})")

    s, new_msg = request("POST", f"/api/v1/chat/conversations/{target_conv_id}/messages", {
        "text": "Hey Priya, verified the Google OAuth token validation logic!",
        "reply_to": None
    })
    assert_true(s == 201 and "id" in new_msg, "POST /api/v1/chat/conversations/<id>/messages sends new message")
    msg_id = new_msg.get("id") if isinstance(new_msg, dict) else "msg-1"

    s, res = request("POST", f"/api/v1/chat/messages/{msg_id}/react", {
        "emoji": "🚀",
        "conversation_id": target_conv_id
    })
    assert_true(s == 200, f"POST /api/v1/chat/messages/{msg_id}/react adds emoji reaction")

    s, res = request("GET", "/api/v1/chat/statuses")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 2, f"GET /api/v1/chat/statuses returns 24h developer status updates (count: {len(res) if isinstance(res, list) else 0})")

    s, res = request("POST", "/api/v1/chat/statuses", {
        "text": "🚀 DevSync Master Upgrade fully operational across frontend and backend!",
        "audience": "everyone"
    })
    assert_true(s == 201, f"POST /api/v1/chat/statuses publishes temporary developer status (got {s})")

    # --- 5. REGRESSION CHECKS ---
    print("\n5. Testing Regression on Core Collaboration APIs...")
    # Public repositories (unauthenticated)
    s, res = request("GET", "/api/v1/repositories/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 2, f"GET /api/v1/repositories/ public access works (count: {len(res) if isinstance(res, list) else 0})")

    # Authenticated user sees repositories
    s, res = request("GET", "/api/v1/repositories/", user_header="balajikumar")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 3, f"GET /api/v1/repositories/ authenticated sees full project list (count: {len(res) if isinstance(res, list) else 0})")

    # Developer profiles
    s, res = request("GET", "/api/v1/developers/")
    assert_true(s == 200 and isinstance(res, list) and len(res) >= 4, f"GET /api/v1/developers/ intact (count: {len(res) if isinstance(res, list) else 0})")

    # Pulse 7d timeline
    s, res = request("GET", "/api/v1/developers/naveen3438/pulse?range=7d", user_header="naveen3438")
    assert_true(s == 200 and res.get("range") == "7d" and len(res.get("points", [])) == 7, f"GET /api/v1/developers/naveen3438/pulse 7d intact (points: {len(res.get('points', [])) if isinstance(res, dict) else 0})")

    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 60)
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
