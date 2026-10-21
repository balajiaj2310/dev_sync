"""
DevSync Master Test Suite Runner
Executes all regression suites and end-to-end suites sequentially,
reporting status, execution time, and aggregate pass/fail metrics.
"""

import unittest
import sys
import time

SUITES = [
    # Baseline suites
    "test_collaboration_api",
    "test_contribution_intelligence",
    "test_improvements",
    "test_notifications_page",
    "test_password_recovery_suite",
    "test_protected_security",
    "test_settings_and_profile",
    "test_v2_features",
    "test_voice_ai",
    # Deep QA & Verification suites
    "test_phase2_backend_deep",
    "test_phase3_frontend_static",
    "test_phase4_database_integrity",
    "test_phase5_security_audit",
    "test_phase6_e2e_journeys",
    "tests.test_e2e_feature_repairs",
    "tests.test_email_otp_delivery"
]

def run_master():
    print("=" * 70)
    print("DEVSYNC COMPREHENSIVE END-TO-END QA & REGRESSION TEST RUNNER")
    print("=" * 70)

    total_ran = 0
    total_failures = 0
    total_errors = 0
    suite_results = []
    start_all = time.time()

    for mod_name in SUITES:
        print(f"\n[RUNNING] {mod_name} ...", flush=True)
        t0 = time.time()
        suite = unittest.defaultTestLoader.loadTestsFromName(mod_name)
        runner = unittest.TextTestRunner(verbosity=1)
        res = runner.run(suite)
        elapsed = time.time() - t0
        
        ran = res.testsRun
        fails = len(res.failures)
        errs = len(res.errors)
        total_ran += ran
        total_failures += fails
        total_errors += errs

        status = "PASSED" if (fails == 0 and errs == 0) else "FAILED"
        suite_results.append((mod_name, ran, fails, errs, elapsed, status))
        print(f"[{status}] {mod_name}: {ran} tests, {fails} failures, {errs} errors ({elapsed:.2f}s)")

    total_elapsed = time.time() - start_all
    print("\n" + "=" * 70)
    print("FINAL SUMMARY REPORT")
    print("=" * 70)
    for mod_name, ran, fails, errs, elapsed, status in suite_results:
        print(f" - {mod_name:<35} | {status:<6} | {ran:>3} tests | {fails:>2} fails | {errs:>2} errs | {elapsed:>5.2f}s")
    print("-" * 70)
    print(f"TOTAL: {len(SUITES)} suites | {total_ran} tests executed | {total_failures} failures | {total_errors} errors | {total_elapsed:.2f}s total")
    print("=" * 70)

    if total_failures > 0 or total_errors > 0:
        sys.exit(1)
    else:
        print("\nALL TEST SUITES PASSED! DEVSYNC IS FULLY VERIFIED AND PRODUCTION-READY.")
        sys.exit(0)

if __name__ == "__main__":
    run_master()
