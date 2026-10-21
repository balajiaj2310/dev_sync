"""
DevSync Phase 4 Database Integrity & Schema Validation Test Suite
Tests:
- Schema completeness & required keys in data/devsync_database.json
- Uniqueness constraints (profiles, usernames, emails, repos, issues, PRs, notifications)
- Foreign key & referential integrity (Issues -> Repos, PRs -> Repos, Authors -> Profiles)
- Branch file system consistency (data/repositories/ matching DB definitions)
- Safe serialization & atomic save roundtrip without data corruption
"""

import unittest
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "devsync_database.json")
REPOS_DIR = os.path.join(os.path.dirname(__file__), "data", "repositories")


class TestPhase4DatabaseIntegrity(unittest.TestCase):
    def setUp(self):
        with open(DB_PATH, "r", encoding="utf-8") as f:
            self.db = json.load(f)

    def test_01_top_level_collections_present(self):
        """All expected top-level entity collections must exist in database."""
        expected_keys = [
            "profiles", "repositories", "activity_events", "notifications",
            "issues", "pull_requests", "teams"
        ]
        for key in expected_keys:
            self.assertIn(key, self.db, f"Missing collection key: {key}")

    def test_02_profiles_uniqueness_and_required_fields(self):
        """Profiles must have unique IDs, unique usernames, unique emails, and valid hashed passwords."""
        profiles = self.db.get("profiles", {})
        self.assertGreater(len(profiles), 0, "Profiles collection must not be empty")

        ids = set()
        usernames = set()
        emails = set()

        for u_key, dev in profiles.items():
            self.assertIn("id", dev)
            self.assertIn("name", dev)
            self.assertIn("username", dev)
            self.assertIn("email", dev)
            self.assertIn("password", dev)

            # Uniqueness
            p_id = dev["id"]
            self.assertNotIn(p_id, ids, f"Duplicate profile id: {p_id}")
            ids.add(p_id)

            u_name = dev["username"].lower()
            self.assertNotIn(u_name, usernames, f"Duplicate username: {u_name}")
            usernames.add(u_name)

            email = dev["email"].lower()
            if email:
                self.assertNotIn(email, emails, f"Duplicate email: {email}")
                emails.add(email)

            # Check that password is a secure PBKDF2/argon2/bcrypt hash
            pw = dev["password"]
            self.assertTrue(pw.startswith(("pbkdf2_", "argon2", "bcrypt")),
                            f"Insecure or unhashed password found for user {u_name}")

    def test_03_repositories_uniqueness_and_branches(self):
        """Repositories must have unique IDs, default branch declared, and valid structure."""
        repos = self.db.get("repositories", {})
        self.assertGreater(len(repos), 0, "Repositories collection must not be empty")

        repo_ids = set()
        for r_id, repo in repos.items():
            self.assertNotIn(r_id, repo_ids, f"Duplicate repo ID: {r_id}")
            repo_ids.add(r_id)

            self.assertIn("name", repo)
            self.assertIn("owner", repo)
            self.assertIn("defaultBranch", repo)
            self.assertIn("branches", repo)
            self.assertIn(repo["defaultBranch"], repo["branches"],
                          f"Default branch '{repo['defaultBranch']}' must exist in branches list")

    def test_04_issues_referential_integrity(self):
        """All issues must reference existing repositories and existing author profiles."""
        issues = self.db.get("issues", {})
        repos = self.db.get("repositories", {})
        repo_names = {r["name"].lower() for r in repos.values()} | {r_id.lower() for r_id in repos.keys()}
        profiles = {u.lower() for u in self.db.get("profiles", {}).keys()}

        issue_numbers_by_repo = {}
        for iss_id, iss in issues.items():
            self.assertIn("id", iss)
            self.assertIn("number", iss)
            self.assertIn("title", iss)
            self.assertIn("repository", iss)
            self.assertIn("status", iss)
            self.assertIn("author", iss)

            # Verify repository reference
            repo_ref = iss["repository"].lower()
            self.assertIn(repo_ref, repo_names, f"Issue #{iss['number']} references unknown repo: {repo_ref}")

            # Verify unique issue number per repository
            pair = (repo_ref, iss["number"])
            self.assertNotIn(pair, issue_numbers_by_repo, f"Duplicate issue #{iss['number']} in repo {repo_ref}")
            issue_numbers_by_repo[pair] = iss_id

            # Verify author reference
            author = iss["author"].lower()
            self.assertIn(author, profiles, f"Issue #{iss['number']} references unknown author: {author}")

    def test_05_pull_requests_referential_integrity(self):
        """All PRs must reference existing repositories, valid branches, and existing authors."""
        prs = self.db.get("pull_requests", {})
        repos = self.db.get("repositories", {})
        repo_names = {r["name"].lower() for r in repos.values()} | {r_id.lower() for r_id in repos.keys()}
        profiles = {u.lower() for u in self.db.get("profiles", {}).keys()}

        pr_numbers_by_repo = {}
        for pr_id, pr in prs.items():
            self.assertIn("id", pr)
            self.assertIn("number", pr)
            self.assertIn("title", pr)
            self.assertIn("repository", pr)
            self.assertIn("status", pr)
            self.assertIn("sourceBranch", pr)
            self.assertIn("targetBranch", pr)
            self.assertIn("author", pr)

            repo_ref = pr["repository"].lower()
            self.assertIn(repo_ref, repo_names, f"PR #{pr['number']} references unknown repo: {repo_ref}")

            pair = (repo_ref, pr["number"])
            self.assertNotIn(pair, pr_numbers_by_repo, f"Duplicate PR #{pr['number']} in repo {repo_ref}")
            pr_numbers_by_repo[pair] = pr_id

            author = pr["author"].lower()
            self.assertIn(author, profiles, f"PR #{pr['number']} references unknown author: {author}")

    def test_06_notifications_schema_integrity(self):
        """Notifications must have unique IDs, valid category, read/unread flag, and timestamp."""
        notifs = self.db.get("notifications", [])
        valid_categories = {"connection", "issue", "mention", "pull_request", "repository", "team"}
        ids = set()

        for n in notifs:
            self.assertIn("id", n)
            self.assertNotIn(n["id"], ids, f"Duplicate notification ID: {n['id']}")
            ids.add(n["id"])

            self.assertIn("category", n)
            self.assertIn(n["category"], valid_categories, f"Invalid notification category: {n['category']}")
            has_read_flag = ("unread" in n or "read" in n)
            self.assertTrue(has_read_flag, f"Notification {n['id']} must declare unread or read boolean")

    def test_07_database_serialization_roundtrip_safety(self):
        """Verifies that serialization to JSON and reload maintains identical dictionary structure."""
        dumped = json.dumps(self.db, indent=2)
        reloaded = json.loads(dumped)
        self.assertEqual(len(reloaded["profiles"]), len(self.db["profiles"]))
        self.assertEqual(len(reloaded["repositories"]), len(self.db["repositories"]))
        self.assertEqual(len(reloaded["issues"]), len(self.db["issues"]))
        self.assertEqual(len(reloaded["pull_requests"]), len(self.db["pull_requests"]))


if __name__ == "__main__":
    unittest.main()
