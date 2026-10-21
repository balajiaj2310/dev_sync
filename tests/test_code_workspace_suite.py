"""
DevSync Code Workspace & Browser IDE Comprehensive Test Suite
Validates workspace info, hierarchical file tree, CRUD file operations,
path traversal security, ZIP packaging, sandbox code execution with stdin/stdout/errors,
execution history, Git status & commit tracking, external IDE integration, and RBAC.
"""

import unittest
import os
import io
import time
import zipfile
import json
from typing import Dict, Any

from backend_collaboration import REPOSITORIES, ACTIVITY_EVENTS
from backend_execution import (
    SUPPORTED_LANGUAGES, ExecutionProviderFactory, MockExecutionProvider,
    ExecutionRequest, ExecutionResult, ExecutionHistoryStore
)
import backend_workspace


class TestCodeWorkspaceSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Force MockExecutionProvider for deterministic sandbox testing
        ExecutionProviderFactory.set_default_provider(MockExecutionProvider())

        now = time.time()
        # Create an isolated test repository for the workspace test suite
        REPOSITORIES['test-workspace-suite'] = {
            'id': 'repo-test-ws',
            'name': 'test-workspace-suite',
            'owner': 'balajikumar',
            'description': 'DevSync Workspace test repository',
            'language': 'Python',
            'visibility': 'Private',
            'defaultBranch': 'main',
            'branches': ['main', 'develop'],
            'members': [
                {'username': 'balajikumar', 'role': 'Owner'},
                {'username': 'naveen3438', 'role': 'Maintainer'},
                {'username': 'priyas', 'role': 'Collaborator'},
                {'username': 'vikramrao', 'role': 'Viewer'}
            ],
            'files': {
                'main': [
                    {
                        'path': 'manage.py',
                        'name': 'manage.py',
                        'type': 'file',
                        'size': 45,
                        'updated_at': now,
                        'sha256': 'a1b2c3d4e5',
                        'content': '#!/usr/bin/env python\nprint("DevSync Workspace")\n'
                    },
                    {
                        'path': 'src/app.py',
                        'name': 'app.py',
                        'type': 'file',
                        'size': 32,
                        'updated_at': now,
                        'sha256': 'f6e5d4c3b2',
                        'content': 'def run():\n    return 42\n'
                    }
                ],
                'develop': [
                    {
                        'path': 'README.md',
                        'name': 'README.md',
                        'type': 'file',
                        'size': 20,
                        'updated_at': now,
                        'sha256': '1234567890',
                        'content': '# DevSync Develop\n'
                    }
                ]
            },
            'audit_log': []
        }

        # Public test repository for unauthenticated access tests
        REPOSITORIES['test-public-showcase'] = {
            'id': 'repo-test-public',
            'name': 'test-public-showcase',
            'owner': 'balajikumar',
            'description': 'Public showcase repository',
            'language': 'JavaScript',
            'visibility': 'Public',
            'defaultBranch': 'main',
            'branches': ['main'],
            'members': [
                {'username': 'balajikumar', 'role': 'Owner'}
            ],
            'files': {
                'main': [
                    {
                        'path': 'index.js',
                        'name': 'index.js',
                        'type': 'file',
                        'size': 35,
                        'updated_at': now,
                        'sha256': 'fedcba0987',
                        'content': 'console.log("Hello public repo!");\n'
                    }
                ]
            },
            'audit_log': []
        }

    def setUp(self):
        self.owner_user = {'username': 'balajikumar'}
        self.collab_user = {'username': 'priyas'}
        self.viewer_user = {'username': 'vikramrao'}
        self.stranger_user = {'username': 'stranger99'}

    # ----------------------------------------------------------------------
    # 1. Workspace Info & Supported Languages
    # ----------------------------------------------------------------------
    def test_workspace_info_owner_permissions(self):
        ok, info, status = backend_workspace.get_workspace_info('test-workspace-suite', auth_user=self.owner_user)
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(info['repository'], 'test-workspace-suite')
        self.assertEqual(info['userRole'], 'Owner')
        self.assertTrue(info['permissions']['canView'])
        self.assertTrue(info['permissions']['canEdit'])
        self.assertTrue(info['permissions']['canCommit'])
        self.assertFalse(info['permissions']['isReadOnly'])
        self.assertIn('main', info['branches'])
        self.assertEqual(info['defaultBranch'], 'main')
        self.assertGreaterEqual(len(info['supportedLanguages']), 5)

    def test_workspace_info_viewer_permissions(self):
        ok, info, status = backend_workspace.get_workspace_info('test-workspace-suite', auth_user=self.viewer_user)
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(info['userRole'], 'Viewer')
        self.assertTrue(info['permissions']['canView'])
        self.assertFalse(info['permissions']['canEdit'])
        self.assertTrue(info['permissions']['isReadOnly'])

    def test_workspace_info_unauthorized_private(self):
        ok, info, status = backend_workspace.get_workspace_info('test-workspace-suite', auth_user=self.stranger_user)
        self.assertFalse(ok)
        self.assertEqual(status, 403)

    def test_workspace_info_public_repository(self):
        ok, info, status = backend_workspace.get_workspace_info('test-public-showcase', auth_user=None)
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(info['visibility'], 'Public')
        self.assertTrue(info['permissions']['canView'])
        self.assertTrue(info['permissions']['isReadOnly'])

    def test_workspace_info_nonexistent_repo(self):
        ok, info, status = backend_workspace.get_workspace_info('nonexistent-repo-12345')
        self.assertFalse(ok)
        self.assertEqual(status, 404)

    # ----------------------------------------------------------------------
    # 2. Hierarchical File Tree & Branch Isolation
    # ----------------------------------------------------------------------
    def test_get_workspace_tree_structure(self):
        ok, tree_data, status = backend_workspace.get_workspace_tree('test-workspace-suite', branch='main', auth_user=self.owner_user)
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(tree_data['branch'], 'main')
        self.assertGreaterEqual(tree_data['count'], 2)

        paths = [f['path'] for f in tree_data['files']]
        self.assertIn('manage.py', paths)
        self.assertIn('src/app.py', paths)

        # Verify nested directory structure contains 'src'
        tree_roots = [n['name'] for n in tree_data['tree']]
        self.assertIn('manage.py', tree_roots)
        self.assertIn('src', tree_roots)

        src_dir = next(n for n in tree_data['tree'] if n['name'] == 'src')
        self.assertEqual(src_dir['type'], 'directory')
        child_names = [c['name'] for c in src_dir['children']]
        self.assertIn('app.py', child_names)

    def test_get_workspace_tree_branch_isolation(self):
        ok, develop_tree, status = backend_workspace.get_workspace_tree('test-workspace-suite', branch='develop', auth_user=self.owner_user)
        self.assertTrue(ok)
        develop_paths = [f['path'] for f in develop_tree['files']]
        self.assertIn('README.md', develop_paths)
        self.assertNotIn('manage.py', develop_paths)

    def test_get_workspace_tree_invalid_branch(self):
        ok, data, status = backend_workspace.get_workspace_tree('test-workspace-suite', branch='invalid-branch-xyz', auth_user=self.owner_user)
        self.assertFalse(ok)
        self.assertEqual(status, 404)

    # ----------------------------------------------------------------------
    # 3. File CRUD Operations & Path Sanitization
    # ----------------------------------------------------------------------
    def test_file_read_and_metadata(self):
        ok, data, status = backend_workspace.get_workspace_file('test-workspace-suite', 'main', 'manage.py', auth_user=self.owner_user)
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(data['path'], 'manage.py')
        self.assertIn('DevSync Workspace', data['content'])
        self.assertEqual(data['language'], 'python')
        self.assertTrue(bool(data['sha256']))

    def test_file_create_and_read(self):
        file_path = f"tests/unit_{int(time.time())}.py"
        content = "def test_answer(): assert 1 + 1 == 2"

        ok, create_res, status = backend_workspace.create_workspace_file_or_folder(
            'test-workspace-suite', 'main', file_path, item_type='file', initial_content=content, auth_user=self.collab_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 201)
        self.assertEqual(create_res['path'], file_path)

        # Read back
        ok, read_res, status = backend_workspace.get_workspace_file('test-workspace-suite', 'main', file_path, auth_user=self.collab_user)
        self.assertTrue(ok)
        self.assertEqual(read_res['content'], content)

    def test_file_collision_returns_409(self):
        file_path = "manage.py" # Already exists on main
        ok, res, status = backend_workspace.create_workspace_file_or_folder(
            'test-workspace-suite', 'main', file_path, item_type='file', initial_content='test', auth_user=self.owner_user
        )
        self.assertFalse(ok)
        self.assertEqual(status, 409)

    def test_path_traversal_rejection(self):
        dangerous_paths = [
            '../../etc/passwd',
            '..\\..\\windows\\system32\\cmd.exe',
            'folder/../../root.py',
            'folder/\x00/hidden.py'
        ]
        for bad_path in dangerous_paths:
            ok, res, status = backend_workspace.create_workspace_file_or_folder(
                'test-workspace-suite', 'main', bad_path, item_type='file', initial_content='malicious', auth_user=self.owner_user
            )
            self.assertFalse(ok, f"Failed to reject malicious path: {bad_path}")
            self.assertEqual(status, 400)

    def test_file_save_and_update(self):
        file_path = f"config/test_save_{int(time.time())}.json"
        backend_workspace.create_workspace_file_or_folder(
            'test-workspace-suite', 'main', file_path, item_type='file', initial_content='{"v": 1}', auth_user=self.owner_user
        )

        updated_content = '{"v": 2, "status": "active"}'
        ok, save_res, status = backend_workspace.save_workspace_file(
            'test-workspace-suite', 'main', file_path, updated_content, commit_message="Bump version to 2", auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(save_res['size'], len(updated_content.encode('utf-8')))

        # Verify content updated
        ok, read_res, _ = backend_workspace.get_workspace_file('test-workspace-suite', 'main', file_path, auth_user=self.owner_user)
        self.assertEqual(read_res['content'], updated_content)

    def test_file_rename_operation(self):
        old_path = f"temp/old_{int(time.time())}.txt"
        new_path = f"temp/new_{int(time.time())}.txt"
        backend_workspace.create_workspace_file_or_folder(
            'test-workspace-suite', 'main', old_path, item_type='file', initial_content='rename me', auth_user=self.owner_user
        )

        ok, rn_res, status = backend_workspace.rename_workspace_path(
            'test-workspace-suite', 'main', old_path, new_path, commit_message="Rename file", auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(rn_res['newPath'], new_path)

        # Verify old path 404, new path 200
        ok_old, _, st_old = backend_workspace.get_workspace_file('test-workspace-suite', 'main', old_path, auth_user=self.owner_user)
        self.assertFalse(ok_old)
        self.assertEqual(st_old, 404)

        ok_new, read_new, st_new = backend_workspace.get_workspace_file('test-workspace-suite', 'main', new_path, auth_user=self.owner_user)
        self.assertTrue(ok_new)
        self.assertEqual(read_new['content'], 'rename me')

    def test_file_delete_operation(self):
        del_path = f"temp/del_{int(time.time())}.txt"
        backend_workspace.create_workspace_file_or_folder(
            'test-workspace-suite', 'main', del_path, item_type='file', initial_content='delete me', auth_user=self.owner_user
        )

        ok, del_res, status = backend_workspace.delete_workspace_path(
            'test-workspace-suite', 'main', del_path, commit_message="Delete temp file", auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)

        # Verify deleted
        ok, _, st = backend_workspace.get_workspace_file('test-workspace-suite', 'main', del_path, auth_user=self.owner_user)
        self.assertFalse(ok)
        self.assertEqual(st, 404)

    # ----------------------------------------------------------------------
    # 4. ZIP Archive Generation
    # ----------------------------------------------------------------------
    def test_create_workspace_zip_archive(self):
        ok, zip_bytes, filename, status = backend_workspace.create_workspace_zip_archive(
            'test-workspace-suite', branch='main', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertTrue(filename.endswith('.zip'))
        self.assertGreater(len(zip_bytes), 100)

        # Unpack in-memory and verify file contents
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            namelist = zf.namelist()
            self.assertTrue(any('manage.py' in n for n in namelist))
            manage_content = zf.read(next(n for n in namelist if 'manage.py' in n)).decode('utf-8')
            self.assertIn('DevSync Workspace', manage_content)

    # ----------------------------------------------------------------------
    # 5. Code Execution Engine via Provider Abstraction
    # ----------------------------------------------------------------------
    def test_code_execution_python_stdout(self):
        code = 'print("Hello from DevSync!")'
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'main.py', code, language='python', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(res['exit_code'], 0)
        self.assertIn('Hello from DevSync', res['stdout'])
        self.assertEqual(res['status'], 'success')

    def test_code_execution_with_stdin(self):
        code = 'import sys; line = sys.stdin.readline(); print(line)'
        stdin_input = "Naveen Kumar"
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'prompt.py', code, language='python', stdin=stdin_input, auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertIn('Naveen Kumar', res['stdout'])

    def test_code_execution_compilation_or_syntax_error(self):
        code = 'SYNTAX_ERROR_TRIGGER'
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'broken.py', code, language='python', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertNotEqual(res['exit_code'], 0)
        self.assertIn(res['status'], ('compilation_error', 'compile_error', 'runtime_error', 'syntax_error', 'error'))
        self.assertTrue(bool(res['stderr']) or bool(res['compile_output']))

    def test_code_execution_runtime_exception(self):
        code = 'x = 1 / 0'
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'zero.py', code, language='python', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertNotEqual(res['exit_code'], 0)
        self.assertEqual(res['status'], 'runtime_error')
        self.assertIn('ZeroDivisionError', res['stderr'])

    def test_code_execution_timeout_simulation(self):
        code = 'MOCK_TRIGGER_TIMEOUT'
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'loop.py', code, language='python', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(res['status'], 'timeout')
        self.assertEqual(res['exit_code'], 124)
        self.assertIn('timed out', res['stderr'].lower())

    def test_code_execution_oom_simulation(self):
        code = 'MOCK_TRIGGER_OOM'
        ok, res, status = backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'oom.py', code, language='python', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(res['status'], 'memory_limit_exceeded')
        self.assertEqual(res['exit_code'], 137)
        self.assertIn('memory', res['stderr'].lower())

    def test_code_execution_history_recording(self):
        code = 'print("History test run")'
        backend_workspace.execute_workspace_code(
            'test-workspace-suite', 'main', 'history_test.py', code, language='python', auth_user=self.owner_user
        )

        ok, hist_data, status = backend_workspace.get_workspace_execution_history(
            'test-workspace-suite', limit=10, auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertGreaterEqual(hist_data['count'], 1)
        self.assertEqual(hist_data['history'][0]['language'], 'python')

    # ----------------------------------------------------------------------
    # 6. Git Status & Commit Operations
    # ----------------------------------------------------------------------
    def test_git_status_and_commit_workflow(self):
        ok, status_data, status = backend_workspace.get_workspace_git_status(
            'test-workspace-suite', branch='main', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(status_data['currentBranch'], 'main')

        # Make a commit
        commit_msg = "feat(core): implement secure code execution runner"
        ok_commit, commit_res, status_commit = backend_workspace.commit_workspace_changes(
            'test-workspace-suite', 'main', commit_msg, files=['calc.py'], auth_user=self.owner_user
        )
        self.assertTrue(ok_commit)
        self.assertEqual(status_commit, 201)
        self.assertEqual(len(commit_res['sha']), 40)
        self.assertEqual(len(commit_res['shortSha']), 7)
        self.assertEqual(commit_res['message'], commit_msg)

    # ----------------------------------------------------------------------
    # 7. External IDE Deep Links & CLI Config
    # ----------------------------------------------------------------------
    def test_external_ide_config_generation(self):
        ok, ide_cfg, status = backend_workspace.get_external_ide_config(
            'test-workspace-suite', branch='main', host_url='http://localhost:8000', auth_user=self.owner_user
        )
        self.assertTrue(ok)
        self.assertEqual(status, 200)

        # Clone URLs
        self.assertIn('http://localhost:8000/git/test-workspace-suite.git', ide_cfg['cloneUrls']['https'])
        self.assertIn('git@devsync.io:test-workspace-suite.git', ide_cfg['cloneUrls']['ssh'])

        # IDE Protocols
        ide_links = ide_cfg['ideLinks']
        self.assertTrue(ide_links['vscode']['protocol'].startswith('vscode://vscode.git/clone?url='))
        self.assertTrue(ide_links['pycharm']['protocol'].startswith('jetbrains://pycharm/checkout/git?checkout.repo='))
        self.assertTrue(ide_links['intellij']['protocol'].startswith('jetbrains://idea/checkout/git?checkout.repo='))
        self.assertTrue(ide_links['eclipse']['protocol'].startswith('eclipse://git/clone?url='))
        self.assertTrue(ide_links['visualstudio']['protocol'].startswith('git-client://clone?url='))

        # CLI Setup
        self.assertIn('git clone -b main', ide_cfg['cliSetup']['clone'])
        self.assertIn('archive.zip?branch=main', ide_cfg['archiveUrl'])




import http.server
import threading
import urllib.request
from server import DevSyncHTTPHandler, ACTIVE_SESSIONS


class TestCodeWorkspaceHTTPIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ExecutionProviderFactory.set_default_provider(MockExecutionProvider())
        cls.server = http.server.HTTPServer(('127.0.0.1', 0), DevSyncHTTPHandler)
        cls.port = cls.server.server_port
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

        # Create active test session for balajikumar
        cls.auth_token = "test-ws-http-token-balajikumar"
        ACTIVE_SESSIONS[cls.auth_token] = {
            'username': 'balajikumar',
            'user': {'username': 'balajikumar'},
            'created': time.time()
        }
        cls.headers = {
            'Authorization': f"Bearer {cls.auth_token}",
            'Content-Type': 'application/json'
        }

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_http_get_workspace_languages(self):
        req = urllib.request.Request(f"{self.base_url}/api/v1/workspace/languages")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertGreaterEqual(len(data['languages']), 5)

    def test_http_get_workspace_html_page(self):
        req = urllib.request.Request(f"{self.base_url}/src/pages/repositories/workspace.html")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            html = resp.read().decode('utf-8')
            self.assertIn('Code Workspace', html)
            self.assertIn('monacoEditorRoot', html)

    def test_http_get_workspace_info(self):
        req = urllib.request.Request(f"{self.base_url}/api/v1/workspace/devsync-core/info", headers=self.headers)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data['repository'], 'devsync-core')
            self.assertEqual(data['userRole'], 'Owner')

    def test_http_get_workspace_tree(self):
        req = urllib.request.Request(f"{self.base_url}/api/v1/workspace/devsync-core/tree", headers=self.headers)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data['branch'], 'main')
            self.assertGreaterEqual(data['count'], 1)

    def test_http_post_workspace_file_save(self):
        payload = json.dumps({
            'branch': 'main',
            'path': 'http_test.py',
            'content': 'print("HTTP test")',
            'commitMessage': 'Test commit from HTTP'
        }).encode('utf-8')
        req = urllib.request.Request(
            f"{self.base_url}/api/v1/workspace/devsync-core/file",
            data=payload,
            headers=self.headers,
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertTrue(data['success'])

    def test_http_post_workspace_execute(self):
        payload = json.dumps({
            'branch': 'main',
            'filePath': 'run_http.py',
            'sourceCode': 'print("Hello from HTTP execution")',
            'language': 'python'
        }).encode('utf-8')
        req = urllib.request.Request(
            f"{self.base_url}/api/v1/workspace/devsync-core/execute",
            data=payload,
            headers=self.headers,
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertEqual(data['exit_code'], 0)
            self.assertIn('Hello from DevSync', data['stdout'])

    def test_http_get_workspace_archive_zip(self):
        req = urllib.request.Request(f"{self.base_url}/api/v1/workspace/devsync-core/archive.zip", headers=self.headers)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.headers.get('Content-Type'), 'application/zip')
            zip_bytes = resp.read()
            self.assertGreater(len(zip_bytes), 100)
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                self.assertGreaterEqual(len(zf.namelist()), 1)

    def test_http_get_workspace_ide_config(self):
        req = urllib.request.Request(f"{self.base_url}/api/v1/workspace/devsync-core/ide-config", headers=self.headers)
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode('utf-8'))
            self.assertIn('vscode', data['ideLinks'])
            self.assertIn('cloneUrls', data)


if __name__ == '__main__':
    unittest.main()
