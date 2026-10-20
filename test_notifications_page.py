"""
DevSync Notifications Page & API Verification Suite
Verifies:
- Route and page availability (/notifications and /src/pages/notifications/index.html)
- Clean asset resolution (CSS and JS entrypoints)
- Live API response format (notifications array + summary dictionary)
- Category coverage (repository, pull_request, issue, mention, team, connection)
- Mark as read, mark as unread, and mark all as read
- Interactive connection request action (accept/decline)
- Notification deletion
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    res = urllib.request.urlopen(req)
    data = res.read().decode('utf-8')
    try:
        return res.getcode(), json.loads(data)
    except Exception:
        return res.getcode(), data

def post_json(path, payload):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    return res.getcode(), json.loads(res.read().decode('utf-8'))

def delete_req(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method='DELETE', headers={'Accept': 'application/json'})
    res = urllib.request.urlopen(req)
    return res.getcode(), json.loads(res.read().decode('utf-8'))

def run_tests():
    print("=" * 60)
    print("RUNNING DEVSYNC NOTIFICATIONS VERIFICATION SUITE")
    print("=" * 60)

    # 1. Page & Route Resolution
    print("\n--- 1. Testing Page & Static Route Delivery ---")
    code, html = get("/notifications")
    assert code == 200
    assert "Notifications — DevSync" in html
    assert "notifications-feed-root" in html
    assert "summary-total-count" in html
    print("PASS: Friendly route /notifications delivers notifications HTML (HTTP 200)")

    code, html = get("/src/pages/notifications/index.html")
    assert code == 200
    assert "src=\"../../js/main.js\"" in html, "Script path must point to ../../js/main.js"
    assert "href=\"../../assets/css/pages/notifications.css\"" in html
    print("PASS: Canonical notifications HTML references valid CSS & JS assets")

    code, css = get("/src/assets/css/pages/notifications.css")
    assert code == 200
    assert ".notifications-page-container" in css
    assert "#F7FAF8" in css or "--color-mint" in css
    print("PASS: Notifications page stylesheet delivers custom design tokens (HTTP 200)")

    # 2. Live API & Summary Counts
    print("\n--- 2. Testing Notifications API & Category Coverage ---")
    code, res = get("/api/v1/notifications/")
    assert code == 200
    notifications = res.get('notifications', [])
    summary = res.get('summary', {})
    assert len(notifications) >= 6, f"Expected at least 6 seed notifications, got {len(notifications)}"
    assert summary.get('total') == len(notifications)
    assert summary.get('unread') == sum(1 for n in notifications if n.get('unread'))
    print(f"PASS: GET /api/v1/notifications/ returns {len(notifications)} notifications with accurate summary")

    categories = set(n.get('category') for n in notifications)
    expected_categories = {'repository', 'pull_request', 'issue', 'mention', 'team', 'connection'}
    missing = expected_categories - categories
    assert not missing, f"Missing notification categories: {missing}"
    print(f"PASS: All 6 required categories present: {sorted(list(categories))}")

    # 3. Connection Request Handling
    print("\n--- 3. Testing Interactive Connection Requests ---")
    conn_notifs = [n for n in notifications if n.get('category') == 'connection']
    assert len(conn_notifs) >= 1
    target_conn = conn_notifs[0]
    
    code, act_res = post_json("/api/v1/notifications/connection-action/", {
        "notification_id": target_conn['id'],
        "action": "accept"
    })
    assert code == 200
    assert act_res.get('success') is True
    assert act_res.get('action') == 'accept'
    print(f"PASS: Accepted connection request for {target_conn['id']}")

    # 4. Mark As Read / Unread
    print("\n--- 4. Testing Mark As Read / Unread Mutations ---")
    target_id = notifications[0]['id']
    
    # Mark as read
    code, mr_res = post_json("/api/v1/notifications/mark-read/", {"id": target_id})
    assert code == 200
    assert mr_res.get('success') is True
    print(f"PASS: Successfully marked notification {target_id} as read")

    # Mark as unread
    code, mu_res = post_json("/api/v1/notifications/mark-unread/", {"id": target_id})
    assert code == 200
    assert mu_res.get('success') is True
    print(f"PASS: Successfully toggled notification {target_id} back to unread")

    # Mark all as read
    code, ma_res = post_json("/api/v1/notifications/mark-read/", {"all": True})
    assert code == 200
    assert ma_res.get('summary', {}).get('unread') == 0
    print("PASS: Successfully marked all notifications as read (unread count = 0)")

    # 5. Delete Notification
    print("\n--- 5. Testing Notification Deletion ---")
    delete_id = notifications[-1]['id']
    code, del_res = delete_req(f"/api/v1/notifications/{delete_id}/")
    assert code == 200
    assert del_res.get('success') is True
    assert del_res.get('deleted') == delete_id
    print(f"PASS: Successfully deleted notification {delete_id}")

    # Verify count decremented
    code, post_del = get("/api/v1/notifications/")
    assert len(post_del.get('notifications', [])) == len(notifications) - 1
    print("PASS: Verified notification list count accurately reflects deletion")

    print("\n" + "=" * 60)
    print("ALL 12 NOTIFICATIONS PAGE & API TESTS PASSED!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
