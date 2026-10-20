"""
DevSync Contribution Intelligence Test Suite
Verifies:
1. Data-driven Contribution Impact Score calculation & transparent weighting
2. Insufficient data fallback states
3. 3 Compact Indicators (Impact, Flow, Collaboration)
4. 5 Engineering Strengths (Radar dimensions)
5. Project Contribution Breakdown
6. Time range consistency (7d, 30d, 90d)
7. REST API Endpoints on server
8. Complete removal of legacy 52-week green square heatmap
"""

import unittest
import urllib.request
import urllib.parse
import json
import time

import backend_collaboration
from backend_collaboration import calculate_contribution_intelligence

SERVER_BASE = 'http://127.0.0.1:8000'

class TestContributionIntelligenceUnit(unittest.TestCase):
    def test_active_developer_calculation(self):
        """Active developer with real events must produce valid 0-100 score and metrics."""
        res = calculate_contribution_intelligence('naveen3438', range_type='30d', caller_username='naveen3438')
        self.assertTrue(res['hasSufficientData'])
        self.assertEqual(res['status'], 'calculated')
        self.assertIsInstance(res['score'], int)
        self.assertGreaterEqual(res['score'], 0)
        self.assertLessEqual(res['score'], 100)

        # Check 3 indicators
        indicators = res['indicators']
        self.assertIn('impact', indicators)
        self.assertIn('flow', indicators)
        self.assertIn('collaboration', indicators)

        self.assertIn('delivered', indicators['impact']['value'].lower())
        self.assertIn('resolved', indicators['flow']['value'].lower())
        self.assertIn('interactions', indicators['collaboration']['value'].lower())

        # Check 5 engineering strengths
        strengths = res['strengths']
        self.assertEqual(len(strengths), 5)
        axis_names = [s['axis'] for s in strengths]
        self.assertIn('Review Quality', axis_names)
        self.assertIn('Delivery & Workflow', axis_names)
        self.assertIn('Testing & Reliability', axis_names)
        self.assertIn('Collaboration', axis_names)
        self.assertIn('Issue Resolution', axis_names)

        for s in strengths:
            self.assertGreaterEqual(s['value'], 0)
            self.assertLessEqual(s['value'], 100)

        # Check project distribution
        proj_dist = res['projectDistribution']
        self.assertIsInstance(proj_dist, list)
        self.assertGreater(len(proj_dist), 0)
        total_share = sum(p['sharePercent'] for p in proj_dist)
        self.assertAlmostEqual(total_share, 100.0, delta=1.5)

    def test_inactive_developer_insufficient_data(self):
        """Users with < 2 events must return a clean insufficient_data state without fabricating scores."""
        res = calculate_contribution_intelligence('brand_new_user_99', range_type='30d')
        self.assertFalse(res['hasSufficientData'])
        self.assertEqual(res['status'], 'insufficient_data')
        self.assertIsNone(res['score'])
        self.assertIn('Insufficient activity', res['message'])
        self.assertEqual(len(res['strengths']), 5)
        for s in res['strengths']:
            self.assertEqual(s['value'], 0)
        self.assertEqual(len(res['projectDistribution']), 0)

    def test_time_range_consistency(self):
        """Testing ranges 7d, 30d, 90d must return appropriate range metadata and valid bounds."""
        for r in ['7d', '30d', '90d']:
            res = calculate_contribution_intelligence('naveen3438', range_type=r, caller_username='naveen3438')
            self.assertEqual(res['range'], r)
            if res['hasSufficientData']:
                self.assertGreaterEqual(res['score'], 0)
                self.assertLessEqual(res['score'], 100)

    def test_project_filter(self):
        """Project filter must constrain records to the specified repository."""
        res = calculate_contribution_intelligence('naveen3438', range_type='30d', project_filter='devsync-core', caller_username='naveen3438')
        self.assertEqual(res['project'], 'devsync-core')
        for p in res['projectDistribution']:
            self.assertEqual(p['name'].lower(), 'devsync-core')


class TestContributionIntelligenceAPI(unittest.TestCase):
    def test_api_developer_endpoint(self):
        """GET /api/v1/developers/<username>/contribution-intelligence returns 200 with schema."""
        url = f"{SERVER_BASE}/api/v1/developers/naveen3438/contribution-intelligence?range=30d"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data['username'], 'naveen3438')
            self.assertTrue(data['hasSufficientData'])
            self.assertIn('indicators', data)
            self.assertIn('strengths', data)
            self.assertIn('projectDistribution', data)

    def test_api_analytics_endpoint(self):
        """GET /api/v1/analytics/contribution-intelligence returns 200 with schema."""
        url = f"{SERVER_BASE}/api/v1/analytics/contribution-intelligence?range=30d"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertIn('score', data)
            self.assertIn('indicators', data)

    def test_api_insufficient_user(self):
        """GET for inactive user returns 200 with hasSufficientData: False and score: null."""
        url = f"{SERVER_BASE}/api/v1/developers/brand_new_inactive/contribution-intelligence"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertFalse(data['hasSufficientData'])
            self.assertIsNone(data['score'])
            self.assertEqual(data['status'], 'insufficient_data')


class TestHeatmapRemoval(unittest.TestCase):
    def test_no_heatmap_in_analytics_page(self):
        """The 52-week annual contribution heatmap must not exist in analytics HTML."""
        with open('frontend/src/pages/analytics/index.html', 'r', encoding='utf-8') as f:
            html = f.read()

        self.assertNotIn('Annual Contribution Heatmap', html)
        self.assertNotIn('heatmapGrid', html)
        self.assertNotIn('heatmap-months-row', html)
        self.assertNotIn('heatmap-cell', html)
        self.assertIn('Contribution Intelligence', html)
        self.assertIn('contributionIntelligenceSection', html)

    def test_no_random_heatmap_in_analytics_js(self):
        """Analytics JS must not contain Math.random() heatmap generation."""
        with open('frontend/src/js/pages/analytics.js', 'r', encoding='utf-8') as f:
            js = f.read()

        self.assertNotIn('Math.random()', js)
        self.assertNotIn('heatmapGrid', js)
        self.assertIn('getContributionIntelligence', js)


if __name__ == '__main__':
    unittest.main()
