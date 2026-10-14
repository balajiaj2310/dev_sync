"""
DevSync Robust Local Development Server
Provides complete static asset resolution, routing aliases, true HTTP error handling
(404, 500, 401, 403, 405, 429), Developer Public Profile REST APIs, and AI Assistant integration.
"""

import http.server
import socketserver
import os
import sys
import urllib.parse
import mimetypes
import json

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

# In-Memory Database for Developer Profiles (Server-Side Source of Truth)
DEV_PROFILES = {
    'naveen3438': {
        'id': 'dev-naveen',
        'name': 'Naveen Kumar D',
        'username': 'naveen3438',
        'email': 'naveen@devsync.dev',
        'role': 'Developer',
        'isVerified': True,
        'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'headline': 'BCA student and passionate developer focused on building meaningful web applications and exploring new technologies. Interested in full-stack development, open source and developer communities.',
        'bio': "I'm a BCA student at Bengaluru City University with a strong interest in web development, backend systems and developer tools. I enjoy building real world projects, learning new technologies and collaborating with other developers. Currently exploring Django, Flask and cloud deployment. My goal is to work on impactful projects and contribute to open source.",
        'location': 'Bengaluru, India',
        'website': 'https://naveenkumar.dev',
        'social': {
            'github': 'https://github.com/naveen3438',
            'linkedin': 'https://linkedin.com/in/naveen-kumar',
            'instagram': 'https://instagram.com/naveen.dev'
        },
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'education': {
            'degree': 'BCA Student',
            'institution': 'Bengaluru City University',
            'location': 'Bengaluru, India',
            'field': 'Computer Applications',
            'timeline': '2022 - 2025'
        },
        'experience': [
            {
                'role': 'Full Stack Intern',
                'organization': 'Chaturya Tech Club',
                'timeline': '2023 - Present',
                'description': 'Building event registration portals and student developer community platforms with Django.'
            }
        ],
        'stats': {
            'followers': 24,
            'following': 18,
            'projects': 5,
            'teams': 2,
            'repositoriesCount': 12,
            'contributionsCount': 48,
            'pullRequestsCount': 8,
            'issuesCount': 24
        },
        'skills': [
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'Django', 'category': 'Backend', 'color': 'mint'},
            {'name': 'Flask', 'category': 'Backend', 'color': 'blue'},
            {'name': 'Java', 'category': 'Backend', 'color': 'blue'},
            {'name': 'JavaScript', 'category': 'Frontend', 'color': 'amber'},
            {'name': 'HTML', 'category': 'Frontend', 'color': 'rose'},
            {'name': 'CSS', 'category': 'Frontend', 'color': 'purple'},
            {'name': 'MySQL', 'category': 'Database', 'color': 'cyan'},
            {'name': 'Git', 'category': 'Tool', 'color': 'neutral'},
            {'name': 'GitHub', 'category': 'Tool', 'color': 'neutral'},
            {'name': 'Bootstrap', 'category': 'Frontend', 'color': 'purple'},
            {'name': 'SQL', 'category': 'Database', 'color': 'cyan'}
        ],
        'pinnedProjects': ['repo-chaturya', 'repo-college', 'repo-portfolio'],
        'projects': [
            {
                'id': 'repo-chaturya',
                'name': 'chaturyanew',
                'description': 'Student developers club website built with Django. Event registrations, workshops and community features.',
                'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Django', 'color': 'mint'}, {'name': 'Bootstrap', 'color': 'purple'}],
                'stars': 28,
                'forks': 6,
                'updated': 'Updated 2 days ago',
                'visibility': 'Public',
                'iconBg': '#10B981',
                'relationship': 'Owner'
            },
            {
                'id': 'repo-college',
                'name': 'college-portal',
                'description': 'Multi-tenant college website for Seshadripuram with admissions, dashboard and student portal.',
                'tags': [{'name': 'Flask', 'color': 'blue'}, {'name': 'SQLite', 'color': 'blue'}, {'name': 'Bootstrap', 'color': 'purple'}],
                'stars': 15,
                'forks': 4,
                'updated': 'Updated 1 week ago',
                'visibility': 'Private',
                'iconBg': '#6366F1',
                'relationship': 'Owner'
            },
            {
                'id': 'repo-portfolio',
                'name': 'portfolio-site',
                'description': 'Personal portfolio website with modern UI and responsive design.',
                'tags': [{'name': 'JavaScript', 'color': 'amber'}, {'name': 'HTML', 'color': 'rose'}, {'name': 'CSS', 'color': 'purple'}],
                'stars': 12,
                'forks': 3,
                'updated': 'Updated 3 weeks ago',
                'visibility': 'Public',
                'iconBg': '#1E293B',
                'relationship': 'Owner'
            },
            {
                'id': 'repo-devsync',
                'name': 'DevSync Core',
                'description': 'Main platform for developer collaboration with repositories, teams and discussions.',
                'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Django', 'color': 'mint'}, {'name': 'PostgreSQL', 'color': 'cyan'}],
                'stars': 42,
                'forks': 11,
                'updated': 'Updated 5 days ago',
                'visibility': 'Public',
                'iconBg': '#0D9488',
                'relationship': 'Contributor'
            },
            {
                'id': 'repo-events',
                'name': 'Event Management',
                'description': 'Cultural and technical event management system for college.',
                'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Flask', 'color': 'blue'}, {'name': 'Bootstrap', 'color': 'purple'}],
                'stars': 18,
                'forks': 7,
                'updated': 'Updated 2 weeks ago',
                'visibility': 'Public',
                'iconBg': '#10B981',
                'relationship': 'Owner'
            },
            {
                'id': 'repo-ai',
                'name': 'AI Chatbot',
                'description': 'Floating AI assistant for DevSync to help developers with coding and debugging.',
                'tags': [{'name': 'JavaScript', 'color': 'amber'}, {'name': 'Python', 'color': 'blue'}, {'name': 'API', 'color': 'cyan'}],
                'stars': 25,
                'forks': 9,
                'updated': 'Updated 1 week ago',
                'visibility': 'Public',
                'iconBg': '#8B5CF6',
                'relationship': 'Contributor'
            }
        ],
        'achievements': [
            {'id': 'ach-1', 'title': 'First Project', 'description': 'Created your first public project', 'color': 'green', 'date': 'Jan 2024'},
            {'id': 'ach-2', 'title': 'Collaborator', 'description': 'Worked with 5+ developers', 'color': 'blue', 'date': 'Mar 2024'},
            {'id': 'ach-3', 'title': 'Consistent', 'description': 'Active for 30+ days', 'color': 'purple', 'date': 'May 2024'}
        ],
        'activities': [
            {'id': 'act-1', 'title': 'Updated chaturyanew', 'description': 'Pushed 4 commits to main: Added registration endpoint with QR code verification.', 'time': '2 days ago'},
            {'id': 'act-2', 'title': 'Milestone Completed in DevSync Core', 'description': 'Completed Milestone: Developer Public Profile System & AI Assistant integration.', 'time': '5 days ago'},
            {'id': 'act-3', 'title': 'Joined Chaturya Developers team', 'description': 'Accepted invitation to collaborate on open source student developer projects.', 'time': '1 week ago'},
            {'id': 'act-4', 'title': 'Created repository AI Chatbot', 'description': 'Initialized repository with vanilla JS floating assistant widget and documentation.', 'time': '2 weeks ago'}
        ],
        'teams': [
            {'id': 'team-chaturya', 'name': 'Chaturya Developers', 'role': 'Lead Maintainer', 'membersCount': 8, 'avatar': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=64&q=80', 'description': 'Student developers club and open-source project incubator.'},
            {'id': 'team-devsync', 'name': 'DevSync Core Team', 'role': 'Core Contributor', 'membersCount': 14, 'avatar': 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=64&q=80', 'description': 'Engineers building the DevSync collaboration and productivity platform.'}
        ],
        'collaborators': [
            {'name': 'Priya S', 'username': 'priyas', 'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80', 'role': 'Fullstack Developer'},
            {'name': 'Ananya Roy', 'username': 'ananyaroy', 'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=64&q=80', 'role': 'Cloud Engineer'},
            {'name': 'Vikram Rao', 'username': 'vikramrao', 'avatar': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=64&q=80', 'role': 'ML Engineer'}
        ]
    },
    'balajikumar': {
        'id': 'dev-balaji',
        'name': 'Balaji',
        'username': 'Balajikumar',
        'role': 'Core Contributor',
        'isVerified': True,
        'headline': 'Fullstack engineer & open-source contributor.',
        'bio': 'Fullstack engineer & open-source contributor. Building high-performance developer tools and collaboration systems.',
        'location': 'Chennai, India',
        'website': 'https://balajikumar.dev',
        'collaborationStatus': 'Open to project invitations',
        'collaborationStatusType': 'available',
        'skills': [
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'Django', 'category': 'Backend', 'color': 'mint'},
            {'name': 'JavaScript', 'category': 'Frontend', 'color': 'amber'},
            {'name': 'PostgreSQL', 'category': 'Database', 'color': 'cyan'},
            {'name': 'Docker', 'category': 'Tool', 'color': 'neutral'}
        ],
        'pinnedProjects': ['repo-devsync', 'repo-chaturya'],
        'projects': [
            {
                'id': 'repo-devsync',
                'name': 'devsync-core',
                'description': 'Core backend services for DevSync developer collaboration platform.',
                'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Django', 'color': 'mint'}],
                'stars': 28,
                'forks': 5,
                'updated': '2 hours ago',
                'visibility': 'Public',
                'iconBg': '#0D9488'
            }
        ],
        'stats': {'followers': 32, 'following': 15, 'projects': 4, 'teams': 2, 'repositoriesCount': 12, 'contributionsCount': 642, 'pullRequestsCount': 8, 'issuesCount': 24}
    },
    'ananyaroy': {
        'id': 'dev-1',
        'name': 'Ananya Roy',
        'username': 'ananyaroy',
        'role': 'Cloud Engineer',
        'isVerified': True,
        'headline': 'Building high-performance cloud microservices and open source developer utilities.',
        'bio': 'Fullstack engineer passionate about cloud microservices and scalable web applications.',
        'location': 'Hyderabad, India',
        'website': 'https://ananyaroy.dev',
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'skills': [
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'React', 'category': 'Frontend', 'color': 'cyan'},
            {'name': 'PostgreSQL', 'category': 'Database', 'color': 'cyan'},
            {'name': 'Docker', 'category': 'Tool', 'color': 'neutral'}
        ],
        'projects': [],
        'stats': {'followers': 19, 'following': 12, 'projects': 3, 'teams': 1, 'repositoriesCount': 8, 'contributionsCount': 210, 'pullRequestsCount': 5, 'issuesCount': 11}
    }
}

class DevSyncHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def guess_type(self, path):
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
        if path.startswith('frontend/'):
            path = path[len('frontend/'):]

        # Check direct path in frontend
        candidate = os.path.join(FRONTEND_DIR, path.replace('/', os.sep))
        if os.path.exists(candidate) and not os.path.isdir(candidate):
            return candidate

        # Aliases for common root-relative asset requests:
        if path.startswith('assets/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if path.startswith('css/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', 'assets', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if path.startswith('js/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if path.startswith('public/'):
            candidate = os.path.join(FRONTEND_DIR, path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if os.path.isdir(candidate):
            idx = os.path.join(candidate, 'index.html')
            if os.path.exists(idx):
                return idx

        return None

    def send_json(self, status, payload):
        data = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DevSync-User')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

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

        # Developer Profile API Endpoint (GET /api/developers/<username>)
        if path.startswith('/api/developers/'):
            username = path.split('/api/developers/')[-1].strip().lower()
            dev = DEV_PROFILES.get(username)
            if not dev:
                self.send_json(404, {'error': f'Developer @{username} not found'})
                return

            # Server-side privacy check
            caller = self.headers.get('X-DevSync-User', '').strip().lower()
            is_owner = (caller == username)

            profile_copy = json.loads(json.dumps(dev))
            if not is_owner:
                # Strip private projects and private fields for visitors
                profile_copy['projects'] = [p for p in profile_copy.get('projects', []) if p.get('visibility') == 'Public']
                profile_copy.pop('email', None)

            self.send_json(200, profile_copy)
            return

        # Canonical Developer Profile Page Routing: /developers/<username>
        if path.startswith('/developers/') and not any(path.endswith(ext) for ext in ('.html', '.js', '.css', '.svg', '.png', '.jpg')):
            username = path[len('/developers/'):].strip().lower()
            if username in DEV_PROFILES:
                profile_html = os.path.join(FRONTEND_DIR, 'src', 'pages', 'developers', 'profile.html')
                if os.path.exists(profile_html):
                    with open(profile_html, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
            else:
                self.serve_custom_error(404)
                return

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
            except Exception:
                self.serve_custom_error(500)
                return

        # Check if requesting an asset that does not exist
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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DevSync-User')
        self.end_headers()

    def do_PATCH(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

        # Profile Update API Endpoint (PATCH /api/developers/<username>)
        if path.startswith('/api/developers/'):
            username = path.split('/api/developers/')[-1].strip().lower()
            if username not in DEV_PROFILES:
                self.send_json(404, {'error': 'Developer not found'})
                return

            caller = self.headers.get('X-DevSync-User', username).strip().lower()
            if caller != username:
                self.send_json(403, {'error': 'Forbidden: You cannot modify another developer profile.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                updates = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            DEV_PROFILES[username].update(updates)
            self.send_json(200, DEV_PROFILES[username])
            return

        self.serve_custom_error(405)

    def do_POST(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path

        if path == '/api/ai/chat':
            self.handle_ai_chat()
            return

        # Pin Project Endpoint (POST /api/developers/<username>/pin)
        if '/pin' in path and path.startswith('/api/developers/'):
            parts = path.split('/')
            username = parts[3].lower() if len(parts) > 3 else ''
            dev = DEV_PROFILES.get(username)
            if not dev:
                self.send_json(404, {'error': 'Developer not found'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
                repo_id = body.get('projectId')
            except Exception:
                repo_id = None

            pinned = dev.get('pinnedProjects', [])
            if repo_id:
                if repo_id in pinned:
                    pinned.remove(repo_id)
                else:
                    pinned.append(repo_id)
            dev['pinnedProjects'] = pinned
            self.send_json(200, {'pinnedProjects': pinned})
            return

        # Follow Endpoint (POST /api/developers/<username>/follow)
        if '/follow' in path and path.startswith('/api/developers/'):
            parts = path.split('/')
            username = parts[3].lower() if len(parts) > 3 else ''
            dev = DEV_PROFILES.get(username)
            if not dev:
                self.send_json(404, {'error': 'Developer not found'})
                return

            is_following = not dev.get('isFollowing', False)
            dev['isFollowing'] = is_following
            stats = dev.setdefault('stats', {})
            current = stats.get('followers', 24)
            stats['followers'] = current + 1 if is_following else max(0, current - 1)
            self.send_json(200, {'isFollowing': is_following, 'followers': stats['followers']})
            return

        # Default all other unsupported POST operations to 405 Method Not Allowed
        self.serve_custom_error(405)

    def handle_ai_chat(self):
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

        self.send_json(200, {"reply": reply})

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
