"""
DevSync Robust Local Development Server
Provides complete static asset resolution, routing aliases, and true HTTP error handling
(404, 500, 401, 403, 405, 429) with custom HTML error pages matching DevSync branding.
"""

import http.server
import socketserver
import os
import sys
import urllib.parse
import mimetypes

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

# Ensure mimetypes are correctly initialized
mimetypes.init()
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('text/html', '.html')

class DevSyncHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def guess_type(self, path):
        # Override to enforce strict CSS and JS mime types
        base, ext = os.path.splitext(path)
        ext = ext.lower()
        if ext == '.css':
            return 'text/css; charset=utf-8'
        elif ext == '.js':
            return 'application/javascript; charset=utf-8'
        elif ext == '.svg':
            return 'image/svg+xml'
        elif ext == '.html':
            return 'text/html; charset=utf-8'
        return super().guess_type(path)

    def resolve_local_path(self, req_path):
        """Map requested URL path to an actual file inside frontend directory."""
        path = req_path.lstrip('/')
        # Strip potential redundant prefixes
        if path.startswith('frontend/'):
            path = path[len('frontend/'):]

        # Check direct path in frontend
        candidate = os.path.join(FRONTEND_DIR, path.replace('/', os.sep))
        if os.path.exists(candidate) and not os.path.isdir(candidate):
            return candidate

        # Aliases for common root-relative asset requests:
        # /assets/... -> /src/assets/...
        if path.startswith('assets/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        # /css/... -> /src/assets/css/...
        if path.startswith('css/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', 'assets', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        # /js/... -> /src/js/...
        if path.startswith('js/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        # /public/... -> public/...
        if path.startswith('public/'):
            candidate = os.path.join(FRONTEND_DIR, path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        # Directory with index.html
        if os.path.isdir(candidate):
            idx = os.path.join(candidate, 'index.html')
            if os.path.exists(idx):
                return idx

        return None

    def do_GET(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path

        # Root redirect
        if path in ('', '/', '/index.html'):
            self.send_response(302)
            self.send_header('Location', '/src/index.html')
            self.end_headers()
            return

        # Dedicated test API routes for testing HTTP error responses
        if path.startswith('/api/error/'):
            code_str = path.split('/api/error/')[-1]
            try:
                code = int(code_str)
                self.serve_custom_error(code)
                return
            except ValueError:
                pass

        # Try to resolve to a static file
        resolved_file = self.resolve_local_path(path)
        if resolved_file:
            mime_type = self.guess_type(resolved_file)
            try:
                with open(resolved_file, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Cache-Control', 'no-cache, must-revalidate')
                self.end_headers()
                self.wfile.write(content)
                return
            except Exception as e:
                self.serve_custom_error(500)
                return

        # Check if requesting an asset (.css, .js, .png, etc.) that does not exist
        # Never send an HTML error page for an asset to prevent MIME-type rejection in browsers!
        _, ext = os.path.splitext(path)
        if ext.lower() in ('.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'):
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Asset not found.')
            return

        # Regular route not found -> Serve genuine HTTP 404 with custom 404.html
        self.serve_custom_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_POST(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path
        if path == '/api/ai/chat':
            self.handle_ai_chat()
            return

        # Default all other unsupported POST operations to 405 Method Not Allowed
        self.serve_custom_error(405)

    def handle_ai_chat(self):
        import json
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        message = body.get('message', '').strip()

        lower = message.lower()
        if 'debug' in lower or 'error' in lower:
            reply = ("Here are recommended steps to debug errors on DevSync:\n\n"
                     "1. Check Browser Console: Inspect any unhandled JavaScript exceptions or rejected Promises.\n"
                     "2. Verify Network Logs: Confirm status codes, MIME headers, and CORS settings on API endpoints.\n"
                     "3. Token & Headers: Ensure Bearer authentication tokens or session cookies are present on requests.\n"
                     "4. Path Resolution: Use absolute or canonical root-relative paths for stylesheets and scripts.")
        elif 'pull request' in lower or 'pr' in lower or 'review' in lower:
            reply = ("DevSync AI Pull Request Reviewer:\n\n"
                     "• Branch Status: Check that the feature branch is cleanly rebased against main without merge conflicts.\n"
                     "• Tests: Ensure unit and integration test suites pass in the CI/CD pipeline.\n"
                     "• Code Quality: Keep diffs focused, maintain docstrings, and review security boundaries.")
        elif 'explain' in lower or 'snippet' in lower or 'code' in lower or 'function' in lower:
            reply = ("DevSync Code Assistant Analysis:\n\n"
                     "• The codebase uses vanilla ES6 modules, CSS Custom Properties design system tokens, and decoupled services.\n"
                     "• Functions are written to be modular, readable, and resilient against missing DOM nodes.")
        else:
            reply = (f"DevSync AI Assistant received your message: \"{message}\".\n\n"
                     "I am connected and ready to help you manage repositories, review pull requests, or debug code issues across your DevSync workspace!")

        response_bytes = json.dumps({"reply": reply}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response_bytes)

    def serve_custom_error(self, code):
        error_file_map = {
            401: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '401.html'),
            403: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '403.html'),
            404: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '404.html'),
            405: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '405.html'),
            429: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '429.html'),
            500: os.path.join(FRONTEND_DIR, 'src', 'pages', 'errors', '500.html'),
        }

        target_file = error_file_map.get(code, error_file_map[404])

        if os.path.exists(target_file):
            with open(target_file, 'rb') as f:
                content = f.read()
        else:
            content = f"<!DOCTYPE html><html><head><title>Error {code}</title></head><body><h1>Error {code}</h1></body></html>".encode('utf-8')

        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        
        if code == 405:
            self.send_header('Allow', 'GET, HEAD')
        elif code == 429:
            self.send_header('Retry-After', '30')

        self.end_headers()
        self.wfile.write(content)

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), DevSyncHTTPHandler) as httpd:
        print(f"DevSync Server active at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run()
