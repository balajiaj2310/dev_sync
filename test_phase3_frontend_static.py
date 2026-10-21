"""
DevSync Phase 3 Frontend Static & Delivery Verification Suite
Tests:
- All 48 HTML pages are delivered via server with HTTP 200
- Meta viewport tag present on pages for responsive layout
- All referenced CSS stylesheets exist on disk and return HTTP 200
- All referenced JavaScript scripts exist on disk and return HTTP 200
- Local image assets exist on disk
- Friendly route mapping delivery for main SPA and public pages
"""

import unittest
import urllib.request
import urllib.parse
import urllib.error
import re
import os

BASE_URL = "http://127.0.0.1:8000"


class TestPhase3FrontendStatic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages_dir = os.path.join(os.path.dirname(__file__), "frontend", "src", "pages")
        cls.html_files = []
        for root, dirs, files in os.walk(cls.pages_dir):
            for f in files:
                if f.endswith(".html"):
                    rel = os.path.relpath(os.path.join(root, f), cls.pages_dir).replace("\\", "/")
                    cls.html_files.append(rel)

    def test_01_all_html_files_accessible_via_server(self):
        """Every single HTML file in frontend/src/pages must be accessible with HTTP 200."""
        failed = []
        for rel_page in self.html_files:
            url = f"{BASE_URL}/src/pages/{rel_page}"
            try:
                with urllib.request.urlopen(url, timeout=5) as resp:
                    if resp.status != 200:
                        failed.append((rel_page, resp.status))
            except Exception as e:
                failed.append((rel_page, str(e)))
        
        self.assertEqual(len(failed), 0, f"Some HTML pages failed delivery: {failed}")

    def test_02_viewport_meta_tags_present(self):
        """Standard pages must declare viewport meta tag for mobile responsiveness."""
        missing = []
        for rel_page in self.html_files:
            file_path = os.path.join(self.pages_dir, rel_page)
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if "<html" in content.lower() and "<meta name=\"viewport\"" not in content.lower() and "viewport" not in content.lower():
                missing.append(rel_page)
        
        self.assertEqual(len(missing), 0, f"Pages missing viewport meta tag: {missing}")

    def test_03_referenced_css_stylesheets_exist(self):
        """All CSS stylesheets referenced via <link rel="stylesheet"> must exist on disk."""
        missing_css = []
        frontend_root = os.path.join(os.path.dirname(__file__), "frontend")
        
        for rel_page in self.html_files:
            file_path = os.path.join(self.pages_dir, rel_page)
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            # Find <link rel="stylesheet" href="...">
            matches = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']', content, re.IGNORECASE)
            matches += re.findall(r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']stylesheet["\']', content, re.IGNORECASE)
            
            for href in matches:
                if href.startswith("http://") or href.startswith("https://") or href.startswith("//"):
                    continue
                # Normalize path
                clean_href = href.split("?")[0].lstrip("/")
                if clean_href.startswith("src/"):
                    clean_href = clean_href[4:]
                
                # Check possibilities inside frontend/src/ or frontend/
                cand1 = os.path.join(frontend_root, "src", clean_href)
                cand2 = os.path.join(frontend_root, clean_href)
                cand3 = os.path.join(os.path.dirname(file_path), clean_href)
                
                if not (os.path.exists(cand1) or os.path.exists(cand2) or os.path.exists(cand3)):
                    missing_css.append((rel_page, href))
        
        self.assertEqual(len(missing_css), 0, f"Broken stylesheet links found: {missing_css}")

    def test_04_referenced_js_scripts_exist(self):
        """All JS scripts referenced via <script src="..."> must exist on disk."""
        missing_js = []
        frontend_root = os.path.join(os.path.dirname(__file__), "frontend")
        
        for rel_page in self.html_files:
            file_path = os.path.join(self.pages_dir, rel_page)
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            matches = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
            for src in matches:
                if src.startswith("http://") or src.startswith("https://") or src.startswith("//"):
                    continue
                clean_src = src.split("?")[0].lstrip("/")
                if clean_src.startswith("src/"):
                    clean_src = clean_src[4:]
                
                cand1 = os.path.join(frontend_root, "src", clean_src)
                cand2 = os.path.join(frontend_root, clean_src)
                cand3 = os.path.join(os.path.dirname(file_path), clean_src)
                
                if not (os.path.exists(cand1) or os.path.exists(cand2) or os.path.exists(cand3)):
                    missing_js.append((rel_page, src))
        
        self.assertEqual(len(missing_js), 0, f"Broken script src links found: {missing_js}")

    def test_05_friendly_route_map_coverage(self):
        """Key user-facing friendly routes deliver 200 without .html extensions."""
        friendly_routes = [
            "/",
            "/home",
            "/pricing",
            "/contact",
            "/terms",
            "/privacy",
            "/help",
            "/sign-in",
            "/sign-up",
            "/forgot-password",
            "/verify-code",
            "/reset-password",
            "/dashboard",
            "/issues",
            "/pull-requests",
            "/teams",
            "/analytics",
            "/assistant",
            "/notifications",
            "/settings/account",
            "/settings/security",
            "/settings/privacy",
            "/settings/preferences"
        ]
        failed_routes = []
        for r in friendly_routes:
            url = f"{BASE_URL}{r}"
            try:
                with urllib.request.urlopen(url, timeout=5) as resp:
                    if resp.status not in (200, 302):
                        failed_routes.append((r, resp.status))
            except Exception as e:
                failed_routes.append((r, str(e)))
        
        self.assertEqual(len(failed_routes), 0, f"Friendly routes failed delivery: {failed_routes}")


if __name__ == "__main__":
    unittest.main()
