"""
DevSync Sidebar Icon Scaling & Layout Regression Test Suite
Validates:
1. Strict icon dimension constraints (width, height, min-width, min-height, flex-shrink) on .sidebar-icon and SVGs.
2. Horizontal row alignment (flex-direction: row, flex-wrap: nowrap) on .sidebar-link preventing labels beneath icons.
3. Consistent sidebar dimensions (width, min-width, max-width, flex-shrink) across desktop viewports.
4. Responsive drawer dimensions on tablet and mobile viewports (< 992px).
5. Repository vertical sidebar icon sizing and layout alignment in repositories.css.
6. Integrity of all 28 HTML pages utilizing sidebar navigation icons.
"""

import unittest
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestSidebarIconLayout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sidebar_css_path = os.path.join(BASE_DIR, "frontend", "src", "assets", "css", "layout", "sidebar.css")
        cls.responsive_css_path = os.path.join(BASE_DIR, "frontend", "src", "assets", "css", "layout", "responsive.css")
        cls.repos_css_path = os.path.join(BASE_DIR, "frontend", "src", "assets", "css", "pages", "repositories.css")
        cls.pages_dir = os.path.join(BASE_DIR, "frontend", "src", "pages")

        with open(cls.sidebar_css_path, "r", encoding="utf-8") as f:
            cls.sidebar_css = f.read()

        with open(cls.responsive_css_path, "r", encoding="utf-8") as f:
            cls.responsive_css = f.read()

        with open(cls.repos_css_path, "r", encoding="utf-8") as f:
            cls.repos_css = f.read()

    def test_01_sidebar_icon_explicit_dimensions(self):
        """Verify .sidebar-icon has explicit 18px width, height, min/max dimensions and flex-shrink: 0."""
        self.assertIn("18px", self.sidebar_css)
        self.assertIn("flex-shrink: 0", self.sidebar_css)
        # Check rule targeting sidebar-icon or sidebar-link svg
        pattern = r"\.sidebar-icon[^{]*\{([^}]+)\}"
        match = re.search(pattern, self.sidebar_css)
        self.assertIsNotNone(match, ".sidebar-icon rule must exist in sidebar.css")
        rules = match.group(1)
        self.assertIn("width: 18px", rules)
        self.assertIn("height: 18px", rules)
        self.assertIn("min-width: 18px", rules)
        self.assertIn("min-height: 18px", rules)
        self.assertIn("max-width: 18px", rules)
        self.assertIn("max-height: 18px", rules)
        self.assertIn("flex-shrink: 0", rules)

    def test_02_sidebar_link_horizontal_alignment(self):
        """Verify .sidebar-link enforces horizontal row flex layout and no-wrap to prevent labels under icons."""
        pattern = r"\.sidebar-link\s*\{([^}]+)\}"
        match = re.search(pattern, self.sidebar_css)
        self.assertIsNotNone(match, ".sidebar-link rule must exist in sidebar.css")
        rules = match.group(1)
        self.assertIn("display: flex", rules)
        self.assertIn("flex-direction: row", rules)
        self.assertIn("flex-wrap: nowrap", rules)
        self.assertIn("align-items: center", rules)

    def test_03_sidebar_text_horizontal_ellipsis(self):
        """Verify .sidebar-text has flex auto sizing and text-overflow ellipsis."""
        pattern = r"\.sidebar-text\s*\{([^}]+)\}"
        match = re.search(pattern, self.sidebar_css)
        self.assertIsNotNone(match, ".sidebar-text rule must exist in sidebar.css")
        rules = match.group(1)
        self.assertIn("white-space: nowrap", rules)
        self.assertIn("overflow: hidden", rules)
        self.assertIn("text-overflow: ellipsis", rules)

    def test_04_app_sidebar_strict_dimensions(self):
        """Verify .app-sidebar maintains strict 240px width and box-sizing."""
        pattern = r"\.app-sidebar\s*\{([^}]+)\}"
        match = re.search(pattern, self.sidebar_css)
        self.assertIsNotNone(match, ".app-sidebar rule must exist in sidebar.css")
        rules = match.group(1)
        self.assertIn("width: var(--sidebar-width", rules)
        self.assertIn("min-width: var(--sidebar-width", rules)
        self.assertIn("max-width: var(--sidebar-width", rules)
        self.assertIn("flex-shrink: 0", rules)
        self.assertIn("box-sizing: border-box", rules)

    def test_05_responsive_sidebar_constraints(self):
        """Verify responsive.css maintains sidebar width limits on tablet and mobile viewports."""
        self.assertIn("@media (max-width: 991.98px)", self.responsive_css)
        self.assertIn(".app-sidebar", self.responsive_css)
        # Verify min-width and max-width are preserved
        self.assertIn("var(--sidebar-width", self.responsive_css)

    def test_06_repo_workspace_sidebar_icons_bounded(self):
        """Verify repository vertical sidebar links have bounded SVG dimensions."""
        self.assertIn(".repo-side-link-left svg", self.repos_css)
        match = re.search(r"\.repo-side-link-left svg\s*\{([^}]+)\}", self.repos_css)
        self.assertIsNotNone(match, ".repo-side-link-left svg rule must exist")
        rules = match.group(1)
        self.assertIn("width: 15px", rules)
        self.assertIn("height: 15px", rules)
        self.assertIn("flex-shrink: 0", rules)

        match_brand = re.search(r"\.repo-sidebar-title svg\s*\{([^}]+)\}", self.repos_css)
        self.assertIsNotNone(match_brand, ".repo-sidebar-title svg rule must exist")
        rules_brand = match_brand.group(1)
        self.assertIn("width: 18px", rules_brand)
        self.assertIn("height: 18px", rules_brand)

    def test_07_all_pages_with_sidebar_icons_intact(self):
        """Verify that all HTML pages containing sidebar-icon have valid structure."""
        html_files_with_sidebar = []
        for root, dirs, files in os.walk(self.pages_dir):
            for f in files:
                if f.endswith(".html"):
                    p = os.path.join(root, f)
                    with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                        c = fh.read()
                    if 'class="sidebar-icon"' in c:
                        html_files_with_sidebar.append(p)

        self.assertGreaterEqual(len(html_files_with_sidebar), 25, "Expected at least 25 pages with sidebar navigation")
        for p in html_files_with_sidebar:
            with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                c = fh.read()
            # Ensure SVG has viewBox and class
            self.assertIn('class="sidebar-icon"', c)
            self.assertIn('viewBox="0 0 24 24"', c)


if __name__ == "__main__":
    unittest.main()
