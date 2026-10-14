"""
DevSync Robust Local Development & Production Server
Provides complete static asset resolution, routing aliases, multi-threaded request processing,
true HTTP error handling (404, 500, 401, 403, 405, 429), Real Authentication API endpoints,
Developer Directory REST APIs, Developer Public Profile REST APIs, and AI Assistant integration.
"""

import http.server
import socketserver
import os
import sys
import urllib.parse
import mimetypes
import json
import secrets
import time
import re

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(BASE_DIR, 'frontend')):
    FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
else:
    FRONTEND_DIR = BASE_DIR

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

# In-Memory Active Sessions Table: token -> { 'username': username, 'user': dict, 'created': timestamp }
ACTIVE_SESSIONS = {}

# In-Memory Database for Developer Profiles & Users (Server-Side Source of Truth)
DEV_PROFILES = {
    'naveen3438': {
        'id': 'dev-naveen',
        'name': 'Naveen Kumar D',
        'username': 'naveen3438',
        'email': 'naveen@devsync.dev',
        'password': 'demo12345',
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
        'email': 'balaji@devsync.dev',
        'password': 'demo12345',
        'role': 'Core Contributor',
        'isVerified': True,
        'headline': 'Fullstack engineer & open-source contributor.',
        'bio': 'Fullstack engineer & open-source contributor. Building high-performance developer tools and collaboration systems.',
        'location': 'Chennai, India',
        'website': 'https://balajikumar.dev',
        'collaborationStatus': 'Open to project invitations',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
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
        'email': 'ananya@devsync.dev',
        'password': 'demo12345',
        'role': 'Cloud Engineer',
        'isVerified': True,
        'headline': 'Building high-performance cloud microservices and open source developer utilities.',
        'bio': 'Fullstack engineer passionate about cloud microservices and scalable web applications.',
        'location': 'Hyderabad, India',
        'website': 'https://ananyaroy.dev',
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
        'skills': [
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'React', 'category': 'Frontend', 'color': 'cyan'},
            {'name': 'PostgreSQL', 'category': 'Database', 'color': 'cyan'},
            {'name': 'Docker', 'category': 'Tool', 'color': 'neutral'}
        ],
        'projects': [
            {
                'id': 'repo-cloudmesh',
                'name': 'cloud-mesh',
                'description': 'Lightweight service mesh orchestration tool for Kubernetes clusters.',
                'tags': [{'name': 'Go', 'color': 'blue'}, {'name': 'Docker', 'color': 'neutral'}],
                'stars': 34,
                'forks': 8,
                'updated': '3 days ago',
                'visibility': 'Public',
                'iconBg': '#06B6D4'
            }
        ],
        'stats': {'followers': 19, 'following': 12, 'projects': 3, 'teams': 1, 'repositoriesCount': 8, 'contributionsCount': 210, 'pullRequestsCount': 5, 'issuesCount': 11}
    },
    'vikramrao': {
        'id': 'dev-2',
        'name': 'Vikram Rao',
        'username': 'vikramrao',
        'email': 'vikram@devsync.dev',
        'password': 'demo12345',
        'role': 'ML Engineer',
        'isVerified': True,
        'headline': 'Machine Learning specialist, working with PyTorch, model deployment, and FastAPI.',
        'bio': 'Machine Learning specialist focused on large-scale model inference, edge deployment, and PyTorch tooling.',
        'location': 'Pune, India',
        'website': 'https://vikramrao.ai',
        'collaborationStatus': 'Open to project invitations',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'avatar': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
        'skills': [
            {'name': 'PyTorch', 'category': 'AI/ML', 'color': 'rose'},
            {'name': 'FastAPI', 'category': 'Backend', 'color': 'mint'},
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'Docker', 'category': 'Tool', 'color': 'neutral'}
        ],
        'projects': [
            {
                'id': 'repo-embedserver',
                'name': 'embed-server',
                'description': 'High-throughput embedding generation microservice with ONNX runtime.',
                'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'FastAPI', 'color': 'mint'}],
                'stars': 41,
                'forks': 9,
                'updated': '1 week ago',
                'visibility': 'Public',
                'iconBg': '#EF4444'
            }
        ],
        'stats': {'followers': 28, 'following': 14, 'projects': 4, 'teams': 1, 'repositoriesCount': 9, 'contributionsCount': 340, 'pullRequestsCount': 7, 'issuesCount': 14}
    },
    'tarapatel': {
        'id': 'dev-3',
        'name': 'Tara Patel',
        'username': 'tarapatel',
        'email': 'tara@devsync.dev',
        'password': 'demo12345',
        'role': 'DevOps Specialist',
        'isVerified': True,
        'headline': 'DevOps & Site Reliability Engineer focused on Kubernetes orchestration and Terraform.',
        'bio': 'SRE and cloud infrastructure developer with a passion for automated CI/CD pipelines and zero-downtime deployments.',
        'location': 'Mumbai, India',
        'website': 'https://tarapatel.cloud',
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'avatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
        'skills': [
            {'name': 'Kubernetes', 'category': 'DevOps', 'color': 'cyan'},
            {'name': 'Terraform', 'category': 'DevOps', 'color': 'purple'},
            {'name': 'Go', 'category': 'Backend', 'color': 'blue'},
            {'name': 'AWS', 'category': 'Cloud', 'color': 'amber'}
        ],
        'projects': [
            {
                'id': 'repo-tf-modules',
                'name': 'k8s-tf-modules',
                'description': 'Reusable Terraform templates for multi-region EKS clusters.',
                'tags': [{'name': 'Terraform', 'color': 'purple'}, {'name': 'AWS', 'color': 'amber'}],
                'stars': 52,
                'forks': 14,
                'updated': '4 days ago',
                'visibility': 'Public',
                'iconBg': '#8B5CF6'
            }
        ],
        'stats': {'followers': 35, 'following': 20, 'projects': 5, 'teams': 2, 'repositoriesCount': 11, 'contributionsCount': 420, 'pullRequestsCount': 12, 'issuesCount': 18}
    },
    'rahuldev': {
        'id': 'dev-4',
        'name': 'Rahul Dev',
        'username': 'rahuldev',
        'email': 'rahul@devsync.dev',
        'password': 'demo12345',
        'role': 'Frontend Architect',
        'isVerified': True,
        'headline': 'Frontend enthusiast crafting accessible design systems and lightning-fast web experiences.',
        'bio': 'Frontend specialist obsessed with component performance, design token architectures, and accessibility standards.',
        'location': 'Delhi, India',
        'website': 'https://rahuldev.design',
        'collaborationStatus': 'Currently busy',
        'collaborationStatusType': 'busy',
        'openToInvitations': False,
        'avatar': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&q=80',
        'skills': [
            {'name': 'TypeScript', 'category': 'Frontend', 'color': 'blue'},
            {'name': 'Vue', 'category': 'Frontend', 'color': 'mint'},
            {'name': 'CSS Architecture', 'category': 'Frontend', 'color': 'purple'},
            {'name': 'React', 'category': 'Frontend', 'color': 'cyan'}
        ],
        'projects': [
            {
                'id': 'repo-token-engine',
                'name': 'token-engine',
                'description': 'Design token compiler transforming Figma styles into cross-platform CSS/JSON variables.',
                'tags': [{'name': 'TypeScript', 'color': 'blue'}, {'name': 'CSS', 'color': 'purple'}],
                'stars': 67,
                'forks': 18,
                'updated': 'Yesterday',
                'visibility': 'Public',
                'iconBg': '#10B981'
            }
        ],
        'stats': {'followers': 45, 'following': 22, 'projects': 6, 'teams': 2, 'repositoriesCount': 14, 'contributionsCount': 510, 'pullRequestsCount': 15, 'issuesCount': 22}
    }
}

class DevSyncHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def address_string(self):
        # Override to avoid reverse DNS lookup delay on Windows localhost
        return self.client_address[0]

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
        elif ext == '.json':
            return 'application/json; charset=utf-8'
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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(data)

    def serve_html_file(self, file_path):
        with open(file_path, 'rb') as f:
            content = f.read()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(content)

    def get_authenticated_user(self):
        auth_header = self.headers.get('Authorization', '').strip()
        token = None
        if auth_header.startswith('Bearer '):
            token = auth_header[len('Bearer '):].strip()
        elif 'devsync_session=' in self.headers.get('Cookie', ''):
            m = re.search(r'devsync_session=([^;]+)', self.headers.get('Cookie', ''))
            if m:
                token = m.group(1).strip()

        if token and token in ACTIVE_SESSIONS:
            return ACTIVE_SESSIONS[token]['user']

        # Fallback to X-DevSync-User header
        x_user = self.headers.get('X-DevSync-User', '').strip().lower()
        if x_user and x_user in DEV_PROFILES:
            u = DEV_PROFILES[x_user]
            return {
                'id': u['id'],
                'name': u['name'],
                'username': u['username'],
                'email': u.get('email', f"{u['username']}@devsync.dev"),
                'role': u.get('role', 'Developer'),
                'avatar': u.get('avatar', '')
            }
        return None

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DevSync-User')
        self.end_headers()

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

        # Friendly URL route mappings
        route_map = {
            '/login': 'src/pages/auth/sign-in.html',
            '/signin': 'src/pages/auth/sign-in.html',
            '/auth/sign-in': 'src/pages/auth/sign-in.html',
            '/signup': 'src/pages/auth/sign-up.html',
            '/register': 'src/pages/auth/sign-up.html',
            '/auth/sign-up': 'src/pages/auth/sign-up.html',
            '/dashboard': 'src/pages/dashboard/overview.html',
            '/overview': 'src/pages/dashboard/overview.html',
            '/developers': 'src/pages/developers/discover.html',
            '/developers/discover': 'src/pages/developers/discover.html',
            '/connections': 'src/pages/developers/connections.html',
            '/repositories': 'src/pages/repositories/list.html',
            '/pull-requests': 'src/pages/pull-requests/list.html',
            '/issues': 'src/pages/issues/list.html',
            '/teams': 'src/pages/teams/members.html',
        }
        if path in route_map:
            target = os.path.join(FRONTEND_DIR, route_map[path].replace('/', os.sep))
            if os.path.exists(target):
                self.serve_html_file(target)
                return

        # Authenticated Session Status Endpoint (GET /api/v1/auth/me, /api/auth/me, /users/me/, /api/v1/users/me)
        if path in ('/api/v1/auth/me', '/api/auth/me', '/users/me', '/users/me/', '/api/v1/users/me', '/api/v1/user/profile'):
            user = self.get_authenticated_user()
            if not user:
                self.send_json(401, {'detail': 'Authentication required. Please sign in.', 'authenticated': False})
                return
            self.send_json(200, user)
            return

        # Developers Directory List Endpoint (GET /api/v1/developers, GET /api/developers)
        if path in ('/api/v1/developers', '/api/developers'):
            query = urllib.parse.parse_qs(url_parts.query)
            search = query.get('search', [''])[0].strip().lower()
            skill_filter = query.get('skill', [''])[0].strip().lower()

            results = []
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            for dev in DEV_PROFILES.values():
                name_match = (not search) or (search in dev['name'].lower()) or (search in dev['username'].lower()) or (search in dev.get('bio', '').lower())

                # Check skill match
                dev_skills = dev.get('skills', [])
                skill_names = [s.get('name', '').lower() if isinstance(s, dict) else str(s).lower() for s in dev_skills]
                skill_match = (not skill_filter or skill_filter == 'all skills' or skill_filter == 'all') or any(skill_filter == s for s in skill_names)

                if name_match and skill_match:
                    is_owner = (caller == dev['username'].lower())
                    dev_copy = json.loads(json.dumps(dev))
                    dev_copy.pop('password', None)
                    if not is_owner:
                        dev_copy.pop('email', None)
                        dev_copy['projects'] = [p for p in dev_copy.get('projects', []) if p.get('visibility') == 'Public']
                    results.append(dev_copy)

            self.send_json(200, results)
            return

        # Single Developer Profile API Endpoint (GET /api/developers/<username>, /api/v1/developers/<username>)
        if path.startswith('/api/developers/') or path.startswith('/api/v1/developers/'):
            prefix = '/api/v1/developers/' if path.startswith('/api/v1/developers/') else '/api/developers/'
            username = path[len(prefix):].strip().lower()
            dev = DEV_PROFILES.get(username)
            if not dev:
                self.send_json(404, {'error': f'Developer @{username} not found'})
                return

            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
            is_owner = (caller == username)

            profile_copy = json.loads(json.dumps(dev))
            profile_copy.pop('password', None)
            if not is_owner:
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
                    self.serve_html_file(profile_html)
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

    def do_POST(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

        # AI Assistant Chat Endpoint
        if path == '/api/ai/chat':
            self.handle_ai_chat()
            return

        # Authentication Login Endpoint (POST /api/v1/auth/login, /api/v1/auth/token, /auth/token, /api/auth/login)
        login_paths = (
            '/api/v1/auth/login', '/api/v1/auth/token',
            '/api/v1/login', '/api/v1/token',
            '/api/auth/login', '/api/auth/token',
            '/auth/login', '/auth/token',
            '/login', '/token'
        )
        if path in login_paths:
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            email = str(body.get('email', '')).strip().lower()
            password = str(body.get('password', '')).strip()

            if not email or not password:
                self.send_json(400, {'detail': 'Email and password are required.', 'error': 'Missing fields'})
                return

            # Match user in DEV_PROFILES
            matched_user = None
            for u in DEV_PROFILES.values():
                u_email = str(u.get('email', '')).strip().lower()
                u_name = str(u.get('username', '')).strip().lower()
                if email == u_email or email == u_name or email == f"{u_name}@devsync.dev":
                    matched_user = u
                    break

            if not matched_user:
                self.send_json(401, {
                    'detail': 'Invalid email or password. Please verify your credentials and try again.',
                    'error': 'Invalid credentials'
                })
                return

            expected_password = matched_user.get('password', 'demo12345')
            if password != expected_password:
                self.send_json(401, {
                    'detail': 'Invalid email or password. Please verify your credentials and try again.',
                    'error': 'Invalid credentials'
                })
                return

            # Valid credentials: create token and active session
            token = f"devsync_token_{secrets.token_hex(20)}"
            user_summary = {
                'id': matched_user['id'],
                'name': matched_user['name'],
                'username': matched_user['username'],
                'email': matched_user.get('email', f"{matched_user['username']}@devsync.dev"),
                'role': matched_user.get('role', 'Developer'),
                'avatar': matched_user.get('avatar', ''),
                'location': matched_user.get('location', '')
            }
            ACTIVE_SESSIONS[token] = {
                'username': matched_user['username'].lower(),
                'user': user_summary,
                'created': time.time()
            }

            self.send_json(200, {
                'access': token,
                'token': token,
                'user': user_summary,
                'message': f"Welcome back, {matched_user['name']}!"
            })
            return

        # Authentication Logout Endpoint
        if path in ('/api/v1/auth/logout', '/api/auth/logout'):
            auth_header = self.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[len('Bearer '):].strip()
                ACTIVE_SESSIONS.pop(token, None)
            self.send_json(200, {'success': True, 'message': 'Logged out successfully.'})
            return

        # Registration Endpoint
        if path in ('/api/v1/auth/register', '/auth/register/', '/auth/register'):
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            username = str(body.get('username', '')).strip().lower()
            email = str(body.get('email', '')).strip().lower()
            name = str(body.get('name', username)).strip()
            password = str(body.get('password', 'demo12345')).strip()

            if not username or not email:
                self.send_json(400, {'detail': 'Username and email are required.'})
                return

            if username in DEV_PROFILES:
                self.send_json(400, {'detail': 'Username already exists.'})
                return

            new_user = {
                'id': f'dev-{username}',
                'name': name or username,
                'username': username,
                'email': email,
                'password': password,
                'role': 'Developer',
                'isVerified': False,
                'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                'headline': 'New DevSync Developer',
                'bio': 'Welcome to my DevSync profile!',
                'location': 'Earth',
                'collaborationStatus': 'Available for collaboration',
                'collaborationStatusType': 'available',
                'openToInvitations': True,
                'skills': [{'name': 'JavaScript', 'color': 'amber'}, {'name': 'Python', 'color': 'blue'}],
                'projects': [],
                'pinnedProjects': [],
                'stats': {'followers': 0, 'following': 0, 'projects': 0, 'teams': 0, 'repositoriesCount': 0, 'contributionsCount': 0, 'pullRequestsCount': 0, 'issuesCount': 0}
            }
            DEV_PROFILES[username] = new_user

            token = f"devsync_token_{secrets.token_hex(20)}"
            ACTIVE_SESSIONS[token] = {
                'username': username,
                'user': new_user,
                'created': time.time()
            }
            self.send_json(201, {'access': token, 'token': token, 'user': new_user})
            return

        # Pin Project Endpoint (POST /api/developers/<username>/pin)
        if '/pin' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            parts = path.split('/')
            username = parts[parts.index('pin') - 1].lower() if 'pin' in parts else ''
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
        if '/follow' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            parts = path.split('/')
            username = parts[parts.index('follow') - 1].lower() if 'follow' in parts else ''
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

    def do_PATCH(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

        # Profile Update API Endpoint (PATCH /api/developers/<username>)
        if path.startswith('/api/developers/') or path.startswith('/api/v1/developers/'):
            prefix = '/api/v1/developers/' if path.startswith('/api/v1/developers/') else '/api/developers/'
            username = path[len(prefix):].strip().lower()
            if username not in DEV_PROFILES:
                self.send_json(404, {'error': 'Developer not found'})
                return

            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
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
            updated_copy = json.loads(json.dumps(DEV_PROFILES[username]))
            updated_copy.pop('password', None)
            self.send_json(200, updated_copy)
            return

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
            self.send_header('Allow', 'GET, HEAD, POST, PATCH')
        elif code == 429:
            self.send_header('Retry-After', '30')

        self.end_headers()
        self.wfile.write(content)

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def run():
    with ThreadingHTTPServer(("", PORT), DevSyncHTTPHandler) as httpd:
        print(f"DevSync Server active at http://localhost:{PORT} and http://127.0.0.1:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run()
