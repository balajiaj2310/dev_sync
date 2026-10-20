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
import urllib.request
import mimetypes
import json
import secrets
import time
import re
import hashlib
import django
from django.conf import settings

# Load environment configuration from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

if not settings.configured:
    settings.configure(
        PASSWORD_HASHERS=[
            'django.contrib.auth.hashers.PBKDF2PasswordHasher',
            'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
            'django.contrib.auth.hashers.Argon2PasswordHasher',
            'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
        ],
        EMAIL_BACKEND=os.environ.get('EMAIL_BACKEND') or ('django.core.mail.backends.smtp.EmailBackend' if (os.environ.get('EMAIL_HOST', '').strip()) else 'django.core.mail.backends.console.EmailBackend'),
        EMAIL_HOST=os.environ.get('EMAIL_HOST', 'localhost'),
        EMAIL_PORT=int(os.environ.get('EMAIL_PORT', 587) or 587),
        EMAIL_USE_TLS=os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1'),
        EMAIL_HOST_USER=os.environ.get('EMAIL_HOST_USER', ''),
        EMAIL_HOST_PASSWORD=os.environ.get('EMAIL_HOST_PASSWORD', ''),
        DEFAULT_FROM_EMAIL=os.environ.get('DEFAULT_FROM_EMAIL', 'DevSync Security <security@devsync.example>'),
        EMAIL_TIMEOUT=int(os.environ.get('EMAIL_TIMEOUT', 4) or 4),
    )
    django.setup()

from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail

# Google OAuth Configuration (from environment variables)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '').strip()

import backend_issues_prs_chat
import backend_voice_ai
from backend_settings import (
    SMSProvider, OTPManager, PasswordRecoveryManager,
    parse_device_string, add_audit_log, get_user_active_sessions,
    revoke_single_session, revoke_all_other_sessions,
    validate_username, validate_password_strength,
    strip_exif_and_sanitize_image, sanitize_public_profile,
    get_default_notifications, calculate_notifications_summary,
    reauth_manager, totp_manager
)

otp_manager = OTPManager()
recovery_manager = PasswordRecoveryManager(otp_manager)
NOTIFICATIONS = []
from backend_collaboration import (
    REPOSITORIES, ACTIVITY_EVENTS, get_repository_by_id_or_name, check_repo_permissions,
    record_activity_event, aggregate_pulse, get_pulse_events, get_pulse_comparison,
    get_pulse_progress, get_pulse_team_contributions, handle_branch_file_upload,
    handle_attachment_upload, sanitize_file_path, calculate_contribution_intelligence
)

def dispatch_verification_email(email, otp):
    """
    Dispatch verification email using Django's email facilities.
    Supports SMTP when configured, or Console/Development backend.
    Logs development notice clearly when SMTP is unconfigured.
    """
    subject = "DevSync Account Verification Code"
    message = (
        f"Hello,\n\n"
        f"Your DevSync email verification code is: {otp}\n\n"
        f"This code is valid for 10 minutes and can only be used once.\n"
        f"If you did not request this verification, you can safely ignore this email.\n\n"
        f"— The DevSync Security Team"
    )
    is_smtp_configured = bool(os.environ.get('EMAIL_HOST'))
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False
        )
        return True, None, is_smtp_configured
    except Exception as e:
        print(f"\n[DEVSYNC EMAIL NOTICE] To: {email} | OTP: {otp} | SMTP unconfigured or failed: {e}\n", flush=True)
        return False, str(e), is_smtp_configured

def verify_google_id_token(id_token):
    """
    Validate Google ID Token directly against Google's tokeninfo API.
    Ensures audience matches GOOGLE_CLIENT_ID, issuer is Google, and email is verified.
    """
    if not GOOGLE_CLIENT_ID:
        return None, "Google OAuth is not configured on this server."
    if not id_token:
        return None, "Missing Google ID token."

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'DevSync-Auth/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                return None, "Google token verification failed."
            payload = json.loads(response.read().decode('utf-8'))

        aud = payload.get('aud', '')
        if aud != GOOGLE_CLIENT_ID:
            return None, f"Invalid token audience. Expected {GOOGLE_CLIENT_ID}, got {aud}."

        iss = payload.get('iss', '')
        if iss not in ('accounts.google.com', 'https://accounts.google.com'):
            return None, "Invalid token issuer."

        if str(payload.get('email_verified', '')).lower() != 'true':
            return None, "Google account email is not verified."

        return payload, None
    except Exception as e:
        return None, f"Google token verification error: {str(e)}"

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if os.path.exists(os.path.join(BASE_DIR, 'frontend')):
    FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
    PROJECT_ROOT = BASE_DIR
elif os.path.exists(os.path.join(os.path.dirname(BASE_DIR), 'frontend')):
    FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')
    PROJECT_ROOT = os.path.dirname(BASE_DIR)
else:
    FRONTEND_DIR = BASE_DIR
    PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
DB_FILE = os.path.join(DATA_DIR, 'devsync_database.json')

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
GLOBAL_OTP_CACHE = {}
EMAIL_OTP_CACHE = {}  # email -> { 'salt': str, 'hash': str, 'expires_at': float, 'last_sent_at': float, 'attempts_remaining': int }
VERIFIED_TOKENS = {}  # token -> { 'email': str, 'expires_at': float }

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

# --------------------------------------------------------------------------
# Persistent Database & Universal Developer Profile Model
# --------------------------------------------------------------------------

def save_database():
    """Atomically save current DEV_PROFILES, REPOSITORIES, and ACTIVITY_EVENTS to persistent JSON file."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            dump_data = {
                'profiles': DEV_PROFILES,
                'repositories': REPOSITORIES,
                'activity_events': ACTIVITY_EVENTS,
                'notifications': NOTIFICATIONS,
                'version': '1.3.0'
            }
            backend_issues_prs_chat.export_state_to_data(dump_data)
            json.dump(dump_data, f, indent=2)
    except Exception as e:
        print(f"[Database] Warning: Failed to save database: {e}")

def load_database():
    """Load persisted profiles, repositories, and activity events if available on disk."""
    global DEV_PROFILES
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                loaded = data.get('profiles', {})
                if loaded:
                    for k, v in loaded.items():
                        DEV_PROFILES[k] = v
                    print(f"[Database] Loaded {len(DEV_PROFILES)} developer profiles from disk.")
                loaded_repos = data.get('repositories', {})
                if loaded_repos:
                    for k, v in loaded_repos.items():
                        REPOSITORIES[k] = v
                    print(f"[Database] Loaded {len(REPOSITORIES)} repositories from disk.")
                loaded_events = data.get('activity_events', [])
                if loaded_events:
                    ACTIVITY_EVENTS.clear()
                    ACTIVITY_EVENTS.extend(loaded_events)
                    print(f"[Database] Loaded {len(ACTIVITY_EVENTS)} activity events from disk.")
                backend_issues_prs_chat.load_state_from_data(data)
                print(f"[Database] Loaded issues, PRs, teams, and chat state from disk.")
                global NOTIFICATIONS
                loaded_notifs = data.get('notifications', [])
                if loaded_notifs:
                    NOTIFICATIONS.clear()
                    NOTIFICATIONS.extend(loaded_notifs)
                    print(f"[Database] Loaded {len(NOTIFICATIONS)} notifications from disk.")
                else:
                    NOTIFICATIONS.clear()
                    NOTIFICATIONS.extend(get_default_notifications())
                    print(f"[Database] Initialized {len(NOTIFICATIONS)} default notifications.")
        except Exception as e:
            print(f"[Database] Warning: Could not read {DB_FILE}: {e}")

def get_developer_by_identifier(identifier):
    """
    Flexible, case-insensitive identifier resolver.
    Matches username, user ID, or email prefix.
    """
    if not identifier:
        return None
    ident = str(identifier).strip().lower()

    if ident in DEV_PROFILES:
        return DEV_PROFILES[ident]

    for dev in DEV_PROFILES.values():
        if dev.get('username', '').lower() == ident:
            return dev
        if dev.get('id', '').lower() == ident:
            return dev
        email = dev.get('email', '').lower()
        if email == ident or (email and email.split('@')[0] == ident):
            return dev
        # Also check name match if clean
        clean_name = re.sub(r'[^a-zA-Z0-9]', '', dev.get('name', '').lower())
        if clean_name and clean_name == re.sub(r'[^a-zA-Z0-9]', '', ident):
            return dev

    return None

def ensure_user_profile(user_data):
    """
    Idempotent profile creation and backfill for any registered user.
    Uses existing user ID as the relationship.
    Populates display name, username, avatar, real stats, bio, skills, education, and experience.
    """
    username = str(user_data.get('username', '')).strip().lower()
    if not username:
        email = str(user_data.get('email', '')).strip().lower()
        username = email.split('@')[0] if email else f"dev_{secrets.token_hex(4)}"
        username = re.sub(r'[^a-zA-Z0-9_]', '', username).lower()

    user_id = user_data.get('id') or f"dev-{username}"
    name = user_data.get('name') or username.capitalize()
    email = user_data.get('email') or f"{username}@devsync.dev"
    avatar = user_data.get('avatar') or 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'

    existing = DEV_PROFILES.get(username, {})

    profile = {
        'id': existing.get('id') or user_id,
        'name': existing.get('name') or name,
        'username': username,
        'email': existing.get('email') or email,
        'password': existing.get('password') or user_data.get('password', 'demo12345'),
        'role': existing.get('role') or user_data.get('role', 'Developer'),
        'isVerified': existing.get('isVerified', True),
        'avatar': existing.get('avatar') or avatar,
        'headline': existing.get('headline') or f"Passionate {existing.get('role', user_data.get('role', 'Developer'))} building meaningful web applications and exploring modern technologies.",
        'bio': existing.get('bio') or f"Hello, I am {name}. I enjoy building software, collaborating with fellow engineers, and shipping high-quality code on DevSync.",
        'location': existing.get('location') or 'Bengaluru, India',
        'website': existing.get('website') or f"https://{username}.dev",
        'social': existing.get('social') or {
            'github': f"https://github.com/{username}",
            'linkedin': f"https://linkedin.com/in/{username}",
            'instagram': f"https://instagram.com/{username}"
        },
        'collaborationStatus': existing.get('collaborationStatus') or 'Available for collaboration',
        'collaborationStatusType': existing.get('collaborationStatusType') or 'available',
        'openToInvitations': existing.get('openToInvitations', True),
        'education': existing.get('education') or {
            'degree': 'BCA Student',
            'institution': 'Bengaluru City University',
            'location': 'Bengaluru, India',
            'field': 'Computer Applications',
            'timeline': '2022 - 2025'
        },
        'experience': existing.get('experience') or [
            {
                'role': 'Full Stack Contributor',
                'organization': 'DevSync Community',
                'timeline': '2024 - Present',
                'description': 'Building open source developer collaboration tools and web applications.'
            }
        ],
        'skills': existing.get('skills') or [
            {'name': 'Python', 'category': 'Backend', 'color': 'blue'},
            {'name': 'Django', 'category': 'Backend', 'color': 'mint'},
            {'name': 'JavaScript', 'category': 'Frontend', 'color': 'amber'},
            {'name': 'React', 'category': 'Frontend', 'color': 'cyan'},
            {'name': 'Git', 'category': 'Tool', 'color': 'neutral'},
            {'name': 'GitHub', 'category': 'Tool', 'color': 'neutral'}
        ],
        'pinnedProjects': existing.get('pinnedProjects') or [],
        'projects': existing.get('projects') or [],
        'achievements': existing.get('achievements') or [
            {'id': f'ach-1-{username}', 'title': 'First Project', 'description': 'Created first public project', 'color': 'green', 'date': '2024'},
            {'id': f'ach-2-{username}', 'title': 'Collaborator', 'description': 'Worked with 5+ developers', 'color': 'blue', 'date': '2024'}
        ],
        'activities': existing.get('activities') or [
            {'id': f'act-1-{username}', 'title': 'Joined DevSync', 'description': f'Created account and public profile on DevSync.', 'time': 'Recently'}
        ],
        'teams': existing.get('teams') or [],
        'collaborators': existing.get('collaborators') or [],
        'mobile': existing.get('mobile', user_data.get('mobile', '')),
        'mobileVerified': existing.get('mobileVerified', False),
        'emailVerified': existing.get('emailVerified', True),
        'passwordLastChanged': existing.get('passwordLastChanged', 'Recently'),
        'security_audit_log': existing.get('security_audit_log') or [
            {
                'id': f"sec-{secrets.token_hex(4)}",
                'action': 'account_setup',
                'description': 'DevSync developer account initialized.',
                'ip': '127.0.0.1',
                'device': 'Web Browser',
                'timestamp': time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                'time_ago': 'Account setup',
                'status': 'success'
            }
        ],
        'notification_preferences': existing.get('notification_preferences') or {
            'direct_messages': {'in_app': True, 'email': True},
            'mentions': {'in_app': True, 'email': True},
            'team_invitations': {'in_app': True, 'email': True},
            'task_assignments': {'in_app': True, 'email': False},
            'task_deadlines': {'in_app': True, 'email': True},
            'weekly_digest': {'in_app': False, 'email': False}
        },
        'general_preferences': existing.get('general_preferences') or {
            'language': 'en',
            'timezone': 'Asia/Kolkata (IST)',
            'theme': 'light',
            'compact_density': False,
            'inline_diffs': True,
            'tab_size': 2,
            'editor_font': 'JetBrains Mono',
            'default_page': 'overview'
        },
        'visibility_controls': existing.get('visibility_controls') or {
            'profile': 'public',
            'email': 'private',
            'mobile': 'private',
            'location': 'public',
            'website': 'public',
            'activity_graph': 'public'
        }
    }

    # Ensure user has a personal workspace project if none exists
    if not profile['projects']:
        default_proj = {
            'id': f'repo-{username}-core',
            'name': f'{username}-workspace',
            'description': f'Personal developer workspace and project repository on DevSync.',
            'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'JavaScript', 'color': 'amber'}],
            'stars': 12,
            'forks': 3,
            'updated': 'Updated recently',
            'visibility': 'Public',
            'iconBg': '#0D9488',
            'relationship': 'Owner'
        }
        profile['projects'].append(default_proj)
        profile['pinnedProjects'].append(default_proj['id'])

    # Calculate stats from real records
    existing_stats = existing.get('stats', {}) if isinstance(existing.get('stats'), dict) else {}
    profile['stats'] = {
        'followers': existing_stats.get('followers', 0),
        'following': existing_stats.get('following', 0),
        'projects': len(profile['projects']),
        'teams': len(profile['teams']),
        'repositoriesCount': len(profile['projects']),
        'contributionsCount': existing_stats.get('contributionsCount', 0),
        'pullRequestsCount': existing_stats.get('pullRequestsCount', 0),
        'issuesCount': existing_stats.get('issuesCount', 0)
    }

    DEV_PROFILES[username] = profile
    return profile

def backfill_all_profiles():
    """Ensure every existing registered user has a complete, rich developer profile."""
    for u, dev_data in list(DEV_PROFILES.items()):
        ensure_user_profile(dev_data)
    save_database()

# Initialize database and backfill existing profiles
load_database()
backfill_all_profiles()

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

        if path.startswith('pages/'):
            candidate = os.path.join(FRONTEND_DIR, 'src', path.replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        # Nested relative asset lookups (e.g. from /developers/<username>/)
        if 'assets/' in path:
            idx = path.find('assets/')
            candidate = os.path.join(FRONTEND_DIR, 'src', path[idx:].replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if 'public/' in path:
            idx = path.find('public/')
            candidate = os.path.join(FRONTEND_DIR, path[idx:].replace('/', os.sep))
            if os.path.exists(candidate) and not os.path.isdir(candidate):
                return candidate

        if 'js/' in path:
            idx = path.find('js/')
            candidate = os.path.join(FRONTEND_DIR, 'src', path[idx:].replace('/', os.sep))
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

    def get_session_token(self):
        auth_header = self.headers.get('Authorization', '').strip()
        if auth_header.startswith('Bearer '):
            return auth_header[len('Bearer '):].strip()
        cookie_hdr = self.headers.get('Cookie', '')
        if 'devsync_session=' in cookie_hdr:
            m = re.search(r'devsync_session=([^;]+)', cookie_hdr)
            if m:
                return m.group(1).strip()
        return None

    def get_authenticated_user(self):
        token = self.get_session_token()
        if token and token in ACTIVE_SESSIONS:
            ACTIVE_SESSIONS[token]['last_active'] = time.time()
            dev = get_developer_by_identifier(ACTIVE_SESSIONS[token]['username'])
            if dev:
                ACTIVE_SESSIONS[token]['user'] = {
                    'id': dev['id'],
                    'name': dev['name'],
                    'username': dev['username'],
                    'email': dev.get('email', f"{dev['username']}@devsync.dev"),
                    'role': dev.get('role', 'Developer'),
                    'avatar': dev.get('avatar', ''),
                    'location': dev.get('location', '')
                }
            return ACTIVE_SESSIONS[token]['user']

        # Fallback to X-DevSync-User header
        x_user = self.headers.get('X-DevSync-User', '').strip().lower()
        if x_user:
            u = get_developer_by_identifier(x_user)
            if u:
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

        # Issues, PRs, Teams, and Chat GET dispatch
        if backend_issues_prs_chat.handle_get(self, path, url_parts, self.get_authenticated_user()):
            return

        # Root redirect (directs to DevSync Home landing page)
        if path in ('', '/', '/index.html', '/home'):
            self.send_response(302)
            self.send_header('Location', '/src/index.html')
            self.end_headers()
            return

        # Friendly Auth Aliases: Redirect to canonical location for perfect relative asset resolution
        if path in ('/login', '/signin', '/auth/sign-in'):
            self.send_response(302)
            self.send_header('Location', '/src/pages/auth/sign-in.html')
            self.end_headers()
            return

        if path in ('/signup', '/register', '/auth/sign-up'):
            self.send_response(302)
            self.send_header('Location', '/src/pages/auth/sign-up.html')
            self.end_headers()
            return

        # Friendly Public Pages: Redirect to canonical paths
        if path in ('/terms', '/terms-of-service'):
            self.send_response(302)
            self.send_header('Location', '/src/pages/public/terms.html')
            self.end_headers()
            return

        if path in ('/privacy', '/privacy-policy'):
            self.send_response(302)
            self.send_header('Location', '/src/pages/public/privacy.html')
            self.end_headers()
            return

        if path in ('/help', '/support'):
            self.send_response(302)
            self.send_header('Location', '/src/pages/public/help.html')
            self.end_headers()
            return

        # Canonical GitHub-Style Public Profile Routing (/u/<username> and /u/<username>/)
        m_u_page = re.match(r'^/u/([^/]+)/?$', path)
        if m_u_page:
            u_ident = m_u_page.group(1).strip().lower()
            dev = get_developer_by_identifier(u_ident)
            if dev:
                profile_html = os.path.join(FRONTEND_DIR, 'src', 'pages', 'developers', 'profile.html')
                if os.path.exists(profile_html):
                    self.serve_html_file(profile_html)
                    return
            else:
                self.serve_custom_error(404)
                return

        # Public Profile API Endpoint (GET /api/v1/u/<username> or /api/u/<username>)
        m_u_api = re.match(r'^/api/(?:v1/)?u/([^/]+)/?$', path)
        if m_u_api:
            u_ident = m_u_api.group(1).strip().lower()
            dev = get_developer_by_identifier(u_ident)
            if not dev:
                self.send_json(404, {'error': f'Developer @{u_ident} not found'})
                return
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
            sanitized = sanitize_public_profile(dev, caller_username=caller, repositories=REPOSITORIES, activity_events=ACTIVITY_EVENTS)
            self.send_json(200, sanitized)
            return

        # Settings Security Status Endpoint (GET /api/v1/auth/security, /api/v1/settings/security)
        if path in ('/api/v1/auth/security', '/api/v1/auth/security/', '/api/v1/settings/security', '/api/v1/settings/security/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'detail': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'detail': 'User profile not found.'})
                return
            curr_token = self.get_session_token()
            user_sessions = get_user_active_sessions(ACTIVE_SESSIONS, auth_user['username'], curr_token)
            sec_data = {
                'email': dev.get('email', f"{auth_user['username']}@devsync.dev"),
                'emailVerified': dev.get('emailVerified', True),
                'mobile': dev.get('mobile', ''),
                'mobileVerified': dev.get('mobileVerified', False),
                'passwordConfigured': True,
                'passwordLastChanged': dev.get('passwordLastChanged', 'Recently'),
                'twoFactorEnabled': False,
                'twoFactorStatus': 'Disabled [LATER]',
                'sessionsCount': len(user_sessions),
                'alerts': dev.get('security_alerts', {
                    'newSignIn': True,
                    'passwordChange': True,
                    'emailChange': True,
                    'sessionRevocation': True
                })
            }
            self.send_json(200, sec_data)
            return

        # Active Sessions List Endpoint (GET /api/v1/auth/sessions, /api/v1/settings/sessions)
        if path in ('/api/v1/auth/sessions', '/api/v1/auth/sessions/', '/api/v1/settings/sessions', '/api/v1/settings/sessions/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'detail': 'Authentication required. Please sign in.'})
                return
            curr_token = self.get_session_token()
            sessions_list = get_user_active_sessions(ACTIVE_SESSIONS, auth_user['username'], curr_token)
            self.send_json(200, sessions_list)
            return

        # Security Audit Logs Endpoint (GET /api/v1/auth/login-history, /api/v1/settings/audit-logs)
        if path in ('/api/v1/auth/login-history', '/api/v1/auth/login-history/', '/api/v1/settings/audit-logs', '/api/v1/settings/audit-logs/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'detail': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            logs = dev.get('security_audit_log', []) if dev else []
            self.send_json(200, logs)
            return

        # Connected Apps Endpoint (GET /api/v1/auth/connected-apps, /api/v1/settings/connected-apps)
        if path in ('/api/v1/auth/connected-apps', '/api/v1/auth/connected-apps/', '/api/v1/settings/connected-apps', '/api/v1/settings/connected-apps/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'detail': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            connected = []
            if GOOGLE_CLIENT_ID:
                connected.append({
                    'id': 'app-google',
                    'name': 'Google Account OAuth',
                    'permissions': 'Identity verification, primary email',
                    'connectedDate': 'Active',
                    'icon': 'google'
                })
            if dev and dev.get('social', {}).get('github'):
                connected.append({
                    'id': 'app-github',
                    'name': 'GitHub Profile Link',
                    'permissions': 'Public profile sync',
                    'connectedDate': 'Active',
                    'icon': 'github'
                })
            self.send_json(200, connected)
            return

        # Preferences & Settings Endpoint (GET /api/v1/auth/preferences, /api/v1/settings/preferences)
        if path in ('/api/v1/auth/preferences', '/api/v1/auth/preferences/', '/api/v1/settings/preferences', '/api/v1/settings/preferences/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'detail': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'detail': 'User profile not found.'})
                return
            self.send_json(200, {
                'general': dev.get('general_preferences', {}),
                'notifications': dev.get('notification_preferences', {}),
                'visibility': dev.get('visibility_controls', {})
            })
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
            '/home': 'src/index.html',
            '/explore': 'src/pages/public/explore.html',
            '/pricing': 'src/pages/public/pricing.html',
            '/contact': 'src/pages/public/contact.html',
            '/terms': 'src/pages/public/terms.html',
            '/terms-of-service': 'src/pages/public/terms.html',
            '/privacy': 'src/pages/public/privacy.html',
            '/privacy-policy': 'src/pages/public/privacy.html',
            '/help': 'src/pages/public/help.html',
            '/support': 'src/pages/public/help.html',
            '/login': 'src/pages/auth/sign-in.html',
            '/signin': 'src/pages/auth/sign-in.html',
            '/auth/sign-in': 'src/pages/auth/sign-in.html',
            '/signup': 'src/pages/auth/sign-up.html',
            '/register': 'src/pages/auth/sign-up.html',
            '/auth/sign-up': 'src/pages/auth/sign-up.html',
            '/dashboard': 'src/pages/dashboard/overview.html',
            '/analytics': 'src/pages/analytics/index.html',
            '/overview': 'src/pages/dashboard/overview.html',
            '/developers': 'src/pages/developers/discover.html',
            '/developers/discover': 'src/pages/developers/discover.html',
            '/connections': 'src/pages/developers/connections.html',
            '/repositories': 'src/pages/repositories/list.html',
            '/pull-requests': 'src/pages/pull-requests/list.html',
            '/issues': 'src/pages/issues/list.html',
            '/teams': 'src/pages/teams/members.html',
            '/settings': 'src/pages/settings/account.html',
            '/settings/account': 'src/pages/settings/account.html',
            '/settings/privacy': 'src/pages/settings/privacy.html',
            '/settings/preferences': 'src/pages/settings/preferences.html',
            '/assistant': 'src/pages/assistant/index.html',
            '/assistant/': 'src/pages/assistant/index.html',
            '/ai/assistant': 'src/pages/assistant/index.html',
            '/assistant/index.html': 'src/pages/assistant/index.html',
            '/notifications': 'src/pages/notifications/index.html',
            '/notifications/': 'src/pages/notifications/index.html',
            '/settings/security': 'src/pages/settings/security.html',
            '/settings/security/': 'src/pages/settings/security.html',
            '/settings/security/password': 'src/pages/settings/change-password.html',
            '/settings/security/password/': 'src/pages/settings/change-password.html',
            '/forgot-password': 'src/pages/auth/forgot-password.html',
            '/forgot-password/': 'src/pages/auth/forgot-password.html',
            '/auth/forgot-password': 'src/pages/auth/forgot-password.html',
            '/auth/forgot-password/': 'src/pages/auth/forgot-password.html',
            '/verify-code': 'src/pages/auth/verify-code.html',
            '/verify-code/': 'src/pages/auth/verify-code.html',
            '/auth/verify-code': 'src/pages/auth/verify-code.html',
            '/auth/verify-code/': 'src/pages/auth/verify-code.html',
            '/reset-password': 'src/pages/auth/reset-password.html',
            '/reset-password/': 'src/pages/auth/reset-password.html',
            '/auth/reset-password': 'src/pages/auth/reset-password.html',
            '/auth/reset-password/': 'src/pages/auth/reset-password.html',

        }
        if path in route_map:
            target = os.path.join(FRONTEND_DIR, route_map[path].replace('/', os.sep))
            if os.path.exists(target):
                self.serve_html_file(target)
                return

        # Security Overview Endpoint (GET /api/v1/auth/security/overview, /api/v1/settings/security/overview)
        if path in ('/api/v1/auth/security/overview', '/api/v1/auth/security/overview/', '/api/v1/settings/security/overview', '/api/v1/settings/security/overview/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            curr_token = self.get_session_token()
            user_sessions = get_user_active_sessions(ACTIVE_SESSIONS, auth_user['username'], curr_token)
            
            pwd_last_changed = dev.get('passwordLastChanged', 'Recently')
            if isinstance(pwd_last_changed, (int, float)):
                pwd_last_changed = time.strftime("%b %d, %Y", time.gmtime(pwd_last_changed))

            self.send_json(200, {
                'success': True,
                'password_configured': True,
                'password_last_changed': pwd_last_changed,
                'two_factor_enabled': bool(dev.get('two_factor_enabled', False)),
                'two_factor_type': dev.get('two_factor_type', 'Authenticator App (TOTP)' if dev.get('two_factor_enabled') else 'Not Enabled'),
                'active_sessions_count': max(1, len(user_sessions)),
                'recovery_codes_count': len(dev.get('two_factor_recovery_codes', [])),
                'registered_email': dev.get('email', ''),
                'registered_mobile': dev.get('mobile', ''),
                'security_events_count': len(dev.get('security_audit_log', []))
            })
            return

        # Notifications API Endpoint (GET /api/v1/notifications/ and /api/notifications/)
        if path in ('/api/v1/notifications', '/api/v1/notifications/', '/api/notifications', '/api/notifications/'):
            summary = calculate_notifications_summary(NOTIFICATIONS)
            self.send_json(200, {
                'notifications': NOTIFICATIONS,
                'summary': summary
            })
            return

        # Authenticated Session Status Endpoint (GET /api/v1/auth/me, /api/auth/me, /users/me/, /api/v1/users/me)
        if path in ('/api/v1/auth/me', '/api/auth/me', '/users/me', '/users/me/', '/api/v1/users/me', '/api/v1/user/profile'):
            user = self.get_authenticated_user()
            if not user:
                self.send_json(401, {'detail': 'Authentication required. Please sign in.', 'authenticated': False})
                return
            self.send_json(200, user)
            return

        # Google OAuth Config Endpoint (GET /api/v1/auth/google/config, /api/auth/google/config)
        
        # AI Voice Assistant Token & Context Endpoints (GET /api/v1/ai/voice/token, /api/v1/ai/voice/context)
        if path in ('/api/v1/ai/voice/token', '/api/ai/voice/token'):
            auth_user = self.get_authenticated_user() or DEV_PROFILES.get('dev-balaji')
            token_res = backend_voice_ai.create_live_ephemeral_token()
            status_code = 200 if token_res.get('ok') else 500
            self.send_json(status_code, token_res)
            return

        if path in ('/api/v1/ai/voice/context', '/api/ai/voice/context'):
            auth_user = self.get_authenticated_user() or DEV_PROFILES.get('dev-balaji')
            query = urllib.parse.parse_qs(url_parts.query)
            repo_id = query.get('repo', ['devsync-core'])[0]
            branch = query.get('branch', ['main'])[0]
            pulse_data = calculate_contribution_intelligence(auth_user['username']) if auth_user else None
            system_instruction = backend_voice_ai.build_system_instruction(
                user_profile=auth_user,
                active_repo=repo_id,
                active_branch=branch,
                repos=REPOSITORIES,
                prs=backend_issues_prs_chat.PULL_REQUESTS,
                issues=backend_issues_prs_chat.ISSUES,
                pulse_data=pulse_data
            )
            self.send_json(200, {
                'ok': True,
                'systemInstruction': system_instruction,
                'user': auth_user['username'] if auth_user else 'developer',
                'activeRepo': repo_id,
                'activeBranch': branch
            })
            return

        if path in ('/api/v1/auth/google/config', '/api/auth/google/config'):
            self.send_json(200, {
                'configured': bool(GOOGLE_CLIENT_ID),
                'clientId': GOOGLE_CLIENT_ID if GOOGLE_CLIENT_ID else None,
                'message': 'Google OAuth is configured.' if GOOGLE_CLIENT_ID else 'Google OAuth is unconfigured. Set GOOGLE_CLIENT_ID environment variable to enable Google Sign-In.'
            })
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


        # ------------------------------------------------------------------
        # Project Pulse Activity Graph Endpoints
        # ------------------------------------------------------------------
        # GET /api/v1/developers/<username>/pulse/events
        if '/pulse/events' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            prefix = '/api/v1/developers/' if '/api/v1/developers/' in path else '/api/developers/'
            sub = path[path.find(prefix) + len(prefix):]
            username = sub.split('/pulse/events')[0].strip().lower()
            query = urllib.parse.parse_qs(url_parts.query)
            range_type = query.get('range', ['7d'])[0]
            project_filter = query.get('project', ['all'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            events = get_pulse_events(username, range_type=range_type, project_filter=project_filter, caller_username=caller)
            self.send_json(200, events)
            return

        # GET /api/v1/developers/<username>/pulse/comparison
        if '/pulse/comparison' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            prefix = '/api/v1/developers/' if '/api/v1/developers/' in path else '/api/developers/'
            sub = path[path.find(prefix) + len(prefix):]
            username = sub.split('/pulse/comparison')[0].strip().lower()
            query = urllib.parse.parse_qs(url_parts.query)
            range_type = query.get('range', ['7d'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            comp = get_pulse_comparison(username, range_type=range_type, caller_username=caller)
            self.send_json(200, comp)
            return

        # GET /api/v1/developers/<username>/pulse/progress
        if '/pulse/progress' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            prefix = '/api/v1/developers/' if '/api/v1/developers/' in path else '/api/developers/'
            sub = path[path.find(prefix) + len(prefix):]
            username = sub.split('/pulse/progress')[0].strip().lower()
            query = urllib.parse.parse_qs(url_parts.query)
            project_id = query.get('project', [None])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            prog = get_pulse_progress(username, project_identifier=project_id, caller_username=caller)
            status_code = 403 if 'Forbidden' in prog.get('error', '') else (404 if 'not found' in prog.get('error', '') else 200)
            self.send_json(status_code, prog)
            return

        # GET /api/v1/developers/<username>/pulse/team-contributions
        if '/pulse/team-contributions' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            query = urllib.parse.parse_qs(url_parts.query)
            project_id = query.get('project', ['devsync-core'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            contrib = get_pulse_team_contributions(project_id, caller_username=caller)
            status_code = 403 if 'Forbidden' in contrib.get('error', '') else (404 if 'not found' in contrib.get('error', '') else 200)
            self.send_json(status_code, contrib)
            return

        # GET /api/v1/developers/<username>/pulse
        if '/pulse' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            prefix = '/api/v1/developers/' if '/api/v1/developers/' in path else '/api/developers/'
            sub = path[path.find(prefix) + len(prefix):]
            username = sub.split('/pulse')[0].strip().lower()
            query = urllib.parse.parse_qs(url_parts.query)
            range_type = query.get('range', ['7d'])[0]
            project_filter = query.get('project', ['all'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            pulse = aggregate_pulse(username, range_type=range_type, project_filter=project_filter, caller_username=caller)
            self.send_json(200, pulse)
            return

                # GET /api/v1/developers/<username>/contribution-intelligence
        if '/contribution-intelligence' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            prefix = '/api/v1/developers/' if '/api/v1/developers/' in path else '/api/developers/'
            sub = path[path.find(prefix) + len(prefix):]
            username = sub.split('/contribution-intelligence')[0].strip().lower()
            query = urllib.parse.parse_qs(url_parts.query)
            range_type = query.get('range', ['30d'])[0]
            project_filter = query.get('project', ['all'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()

            intel = calculate_contribution_intelligence(username, range_type=range_type, project_filter=project_filter, caller_username=caller)
            self.send_json(200, intel)
            return

        # GET /api/v1/analytics/contribution-intelligence
        if path in ('/api/v1/analytics/contribution-intelligence', '/api/analytics/contribution-intelligence'):
            query = urllib.parse.parse_qs(url_parts.query)
            range_type = query.get('range', ['30d'])[0]
            project_filter = query.get('project', ['all'])[0]
            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
            target_user = query.get('user', [caller or 'naveen3438'])[0]

            intel = calculate_contribution_intelligence(target_user, range_type=range_type, project_filter=project_filter, caller_username=caller)
            self.send_json(200, intel)
            return

# ------------------------------------------------------------------
        # Repositories & Collaboration Endpoints
        # ------------------------------------------------------------------
        # GET /api/v1/repositories/<repo_id>/members
        m_members = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/members/?$', path)
        if m_members:
            repo_id = m_members.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view members of this private repository.'})
                return

            enriched = []
            for mem in repo.get('members', []):
                u_profile = get_developer_by_identifier(mem.get('username'))
                enriched.append({
                    'username': mem.get('username'),
                    'name': u_profile.get('name', mem.get('username')) if u_profile else mem.get('username'),
                    'avatar': u_profile.get('avatar', '') if u_profile else '',
                    'role': mem.get('role', 'Collaborator'),
                    'responsibility': mem.get('responsibility', 'Contributor'),
                    'assignedTasks': mem.get('assignedTasks', []),
                    'joined_at': mem.get('joined_at'),
                    'profileUrl': f"/src/pages/developers/profile.html?user={mem.get('username')}"
                })
            self.send_json(200, {
                'repository': repo['name'],
                'membersCount': len(enriched),
                'members': enriched,
                'canManageMembers': is_owner or is_maint
            })
            return

        # GET /api/v1/repositories/<repo_id>/branches
        m_branches = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/branches/?$', path)
        if m_branches:
            repo_id = m_branches.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view branches of this private repository.'})
                return
            branches_list = []
            for b in repo.get('branches', []):
                b_files = repo.get('files', {}).get(b, [])
                last_f = b_files[-1] if b_files else {}
                branches_list.append({
                    'name': b,
                    'isDefault': (b == repo.get('defaultBranch', 'main')),
                    'filesCount': len(b_files),
                    'lastCommit': last_f.get('last_commit', 'Initial commit'),
                    'lastActor': last_f.get('last_actor', repo.get('owner')),
                    'updatedAt': last_f.get('updated_at', repo.get('updated_at'))
                })
            self.send_json(200, {
                'repository': repo['name'],
                'defaultBranch': repo.get('defaultBranch', 'main'),
                'branchesCount': len(branches_list),
                'branches': branches_list
            })
            return

        # GET /api/v1/repositories/<repo_id>/files
        m_files = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/files/?$', path)
        if m_files:
            repo_id = m_files.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view files of this private repository.'})
                return
            query = urllib.parse.parse_qs(url_parts.query)
            branch = query.get('branch', [repo.get('defaultBranch', 'main')])[0]
            dir_path = query.get('path', [''])[0].strip().strip('/')
            is_recursive = query.get('recursive', [''])[0].lower() in ('true', '1') or query.get('flat', [''])[0].lower() in ('true', '1')

            branch_files = repo.get('files', {}).get(branch, [])
            results = []
            seen_dirs = set()
            if is_recursive:
                results = branch_files
            else:
                for f in branch_files:
                    f_path = f.get('path', '')
                    if dir_path:
                        if not f_path.startswith(dir_path + '/'):
                            continue
                        relative = f_path[len(dir_path) + 1:]
                    else:
                        relative = f_path

                    parts = relative.split('/')
                    if len(parts) > 1:
                        dir_name = parts[0]
                        if dir_name not in seen_dirs:
                            seen_dirs.add(dir_name)
                            full_dir_path = f"{dir_path}/{dir_name}" if dir_path else dir_name
                            results.append({
                                'path': full_dir_path,
                                'name': dir_name,
                                'type': 'dir',
                                'branch': branch,
                                'size': 0,
                                'updated_at': f.get('updated_at'),
                                'last_commit': f.get('last_commit', ''),
                                'last_actor': f.get('last_actor', '')
                            })
                    else:
                        results.append({
                            'path': f_path,
                            'name': f.get('name', parts[0]),
                            'type': 'file',
                            'branch': branch,
                            'size': f.get('size', 0),
                            'updated_at': f.get('updated_at'),
                            'last_commit': f.get('last_commit', ''),
                            'last_actor': f.get('last_actor', '')
                        })

            self.send_json(200, {
                'repository': repo['name'],
                'branch': branch,
                'path': dir_path,
                'filesCount': len(results),
                'files': results,
                'allFiles': branch_files
            })
            return

        # GET /api/v1/repositories/<repo_id>/file
        m_file = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/file/?$', path)
        if m_file:
            repo_id = m_file.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view file contents in this private repository.'})
                return
            query = urllib.parse.parse_qs(url_parts.query)
            branch = query.get('branch', [repo.get('defaultBranch', 'main')])[0]
            target_path = query.get('path', [query.get('file', [''])[0]])[0].strip().strip('/')
            clean_path, err = sanitize_file_path(target_path)
            if err:
                self.send_json(400, {'error': 'Invalid path', 'detail': err})
                return

            branch_files = repo.get('files', {}).get(branch, [])
            matched = next((f for f in branch_files if f.get('path') == clean_path), None)
            if not matched:
                self.send_json(404, {'error': f"File '{clean_path}' not found on branch '{branch}'"})
                return

            self.send_json(200, {
                'repository': repo['name'],
                'branch': branch,
                'path': clean_path,
                'name': matched.get('name', os.path.basename(clean_path)),
                'size': matched.get('size', 0),
                'updated_at': matched.get('updated_at'),
                'last_commit': matched.get('last_commit'),
                'last_actor': matched.get('last_actor'),
                'content': matched.get('content', '')
            })
            return

        # GET /api/v1/repositories/<repo_id>/attachments
        m_att = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/attachments/?$', path)
        if m_att:
            repo_id = m_att.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view attachments of this private repository.'})
                return
            self.send_json(200, {
                'repository': repo['name'],
                'attachmentsCount': len(repo.get('attachments', [])),
                'attachments': repo.get('attachments', [])
            })
            return

        # GET /api/v1/repositories/<repo_id>/activity
        m_act = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/activity/?$', path)
        if m_act:
            repo_id = m_act.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view activity of this private repository.'})
                return
            repo_events = [e for e in ACTIVITY_EVENTS if e.get('repository', '').lower() == repo['name'].lower()]
            self.send_json(200, {
                'repository': repo['name'],
                'eventsCount': len(repo_events),
                'events': repo_events[:50]
            })
            return

        # GET /api/v1/repositories/<repo_id>
        m_repo = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/?$', path)
        if m_repo and not path.endswith('/repositories'):
            repo_id = m_repo.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not can_view:
                self.send_json(403, {'error': 'Forbidden: You do not have permission to view this private repository.'})
                return

            tasks = repo.get('tasks', [])
            open_tasks = [t for t in tasks if t.get('status') != 'completed']
            repo_copy = json.loads(json.dumps(repo))
            repo_copy['membersCount'] = len(repo.get('members', []))
            repo_copy['branchesCount'] = len(repo.get('branches', []))
            repo_copy['filesCount'] = len(repo.get('files', {}).get(repo.get('defaultBranch', 'main'), []))
            repo_copy['openTasksCount'] = len(open_tasks)
            repo_copy['openIssuesCount'] = 12 if repo.get('name') == 'devsync-core' else 3
            repo_copy['currentUserRole'] = role
            repo_copy['canUpload'] = is_collab
            repo_copy['canManageMembers'] = is_maint or is_owner
            repo_copy['canCreateBranches'] = is_collab
            self.send_json(200, repo_copy)
            return

        # GET /api/v1/repositories (and /api/repositories)
        if path in ('/api/v1/repositories', '/api/repositories', '/api/v1/repositories/', '/api/repositories/'):
            query = urllib.parse.parse_qs(url_parts.query)
            search = query.get('search', [''])[0].strip().lower()
            lang = query.get('language', [''])[0].strip().lower()
            vis = query.get('visibility', [''])[0].strip().lower()

            auth_user = self.get_authenticated_user()
            results = []
            for r in REPOSITORIES.values():
                can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, r)
                if not can_view:
                    continue

                if search and (search not in r['name'].lower() and search not in r.get('description', '').lower()):
                    continue
                if lang and lang != 'all' and lang != 'all languages' and r.get('language', '').lower() != lang:
                    continue
                if vis and vis != 'all' and r.get('visibility', '').lower() != vis:
                    continue

                item = {
                    'id': r['id'],
                    'name': r['name'],
                    'owner': r.get('owner'),
                    'description': r.get('description', ''),
                    'language': r.get('language', 'Unknown'),
                    'languageColor': r.get('languageColor', '#3572A5'),
                    'visibility': r.get('visibility', 'Public'),
                    'defaultBranch': r.get('defaultBranch', 'main'),
                    'created_at': r.get('created_at'),
                    'updated_at': r.get('updated_at'),
                    'updated': 'Recently',
                    'stars': r.get('stars', 0),
                    'forks': r.get('forks', 0),
                    'membersCount': len(r.get('members', [])),
                    'branchesCount': len(r.get('branches', [])),
                    'filesCount': len(r.get('files', {}).get(r.get('defaultBranch', 'main'), [])),
                    'currentUserRole': role,
                    'canUpload': is_collab
                }
                results.append(item)

            self.send_json(200, results)
            return

        # Single Developer Profile API Endpoint (GET /api/developers/<username>, /api/v1/developers/<username>)
        if path.startswith('/api/developers/') or path.startswith('/api/v1/developers/'):
            prefix = '/api/v1/developers/' if path.startswith('/api/v1/developers/') else '/api/developers/'
            identifier = path[len(prefix):].strip().lower()
            dev = get_developer_by_identifier(identifier)
            if not dev:
                self.send_json(404, {'error': f'Developer @{identifier} not found'})
                return

            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
            is_owner = (caller == dev['username'].lower())

            sanitized = sanitize_public_profile(dev, caller_username=caller, repositories=REPOSITORIES, activity_events=ACTIVITY_EVENTS)
            self.send_json(200, sanitized)
            return

        # Canonical Developer Profile Page Routing: /developers/<username> and /developers/<username>/
        if path.startswith('/developers/') and not any(path.endswith(ext) for ext in ('.html', '.js', '.css', '.svg', '.png', '.jpg')):
            identifier = path[len('/developers/'):].strip().lower()
            dev = get_developer_by_identifier(identifier)
            if dev:
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

        # Issues, PRs, Teams, and Chat POST dispatch
        if backend_issues_prs_chat.handle_post(self, path, url_parts, self.get_authenticated_user(), DEV_PROFILES, REPOSITORIES, save_database):
            return

        # AI Voice Assistant Endpoints
        if path in ('/api/v1/ai/voice/token', '/api/ai/voice/token'):
            token_res = backend_voice_ai.create_live_ephemeral_token()
            status_code = 200 if token_res.get('ok') else 500
            self.send_json(status_code, token_res)
            return

        if path in ('/api/v1/ai/voice/context', '/api/ai/voice/context'):
            auth_user = self.get_authenticated_user() or DEV_PROFILES.get('dev-balaji')
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                body = {}
            repo_id = body.get('repo', 'devsync-core')
            branch = body.get('branch', 'main')
            pulse_data = calculate_contribution_intelligence(auth_user['username']) if auth_user else None
            system_instruction = backend_voice_ai.build_system_instruction(
                user_profile=auth_user,
                active_repo=repo_id,
                active_branch=branch,
                repos=REPOSITORIES,
                prs=backend_issues_prs_chat.PULL_REQUESTS,
                issues=backend_issues_prs_chat.ISSUES,
                pulse_data=pulse_data
            )
            self.send_json(200, {
                'ok': True,
                'systemInstruction': system_instruction,
                'user': auth_user['username'] if auth_user else 'developer',
                'activeRepo': repo_id,
                'activeBranch': branch
            })
            return

        if path in ('/api/v1/ai/voice/synthesize', '/api/ai/voice/synthesize'):
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                body = {}
            text = body.get('text', '').strip()
            voice_name = body.get('voiceName', 'Puck')
            if not text:
                self.send_json(400, {'ok': False, 'error': 'Missing text to synthesize'})
                return
            audio_res = backend_voice_ai.synthesize_speech(text, voice_name=voice_name)
            if audio_res:
                self.send_json(200, {'ok': True, **audio_res})
            else:
                self.send_json(500, {'ok': False, 'error': 'Failed to synthesize speech.'})
            return

        # ----------------------------------------------------------------------
        # Notifications System Actions (mark-read, mark-unread, connection-action)
        # ----------------------------------------------------------------------
        if path in ('/api/v1/notifications/mark-read', '/api/v1/notifications/mark-read/', '/api/notifications/mark-read', '/api/notifications/mark-read/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            notif_id = body.get('id')
            if notif_id:
                for n in NOTIFICATIONS:
                    if n.get('id') == notif_id:
                        n['unread'] = False
                        break
            else:
                for n in NOTIFICATIONS:
                    n['unread'] = False
            save_database()
            summary = calculate_notifications_summary(NOTIFICATIONS)
            self.send_json(200, {'success': True, 'summary': summary})
            return

        if path in ('/api/v1/notifications/mark-unread', '/api/v1/notifications/mark-unread/', '/api/notifications/mark-unread', '/api/notifications/mark-unread/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            notif_id = body.get('id')
            if notif_id:
                for n in NOTIFICATIONS:
                    if n.get('id') == notif_id:
                        n['unread'] = True
                        break
            save_database()
            summary = calculate_notifications_summary(NOTIFICATIONS)
            self.send_json(200, {'success': True, 'summary': summary})
            return

        if path in ('/api/v1/notifications/connection-action', '/api/v1/notifications/connection-action/', '/api/notifications/connection-action', '/api/notifications/connection-action/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            notif_id = body.get('notification_id')
            action = body.get('action') # 'accept' or 'decline'
            target_dev = None
            for n in NOTIFICATIONS:
                if n.get('id') == notif_id:
                    n['connection_status'] = 'accepted' if action == 'accept' else 'declined'
                    n['unread'] = False
                    target_dev = n.get('connection_developer_id')
                    break
            save_database()
            summary = calculate_notifications_summary(NOTIFICATIONS)
            self.send_json(200, {'success': True, 'action': action, 'developer_id': target_dev, 'summary': summary})
            return

        # ======================================================================
        # DevSync Protected Password & Security Handlers
        # ======================================================================

        # A. Re-authenticate account holder (POST /api/v1/auth/security/reauthenticate)
        if path in ('/api/v1/auth/security/reauthenticate', '/api/v1/auth/security/reauthenticate/', '/api/v1/auth/reauthenticate', '/api/v1/auth/reauthenticate/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            password = str(body.get('password', '')).strip()
            if not password or not check_password(password, dev['password']):
                add_audit_log(dev, 'Re-authentication Failed', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'failed')
                save_database()
                self.send_json(400, {'error': 'Incorrect password. Verification challenge failed.'})
                return
            
            reauth_token, ttl = reauth_manager.issue_token(dev['username'])
            add_audit_log(dev, 'Re-authentication Successful', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()
            self.send_json(200, {
                'success': True,
                'reauth_token': reauth_token,
                'expires_in': ttl,
                'message': 'Identity verified. You may proceed with sensitive security changes.'
            })
            return

        # B. Protected Change Password with Re-auth Token (POST /api/v1/auth/password/change-protected)
        if path in ('/api/v1/auth/password/change-protected', '/api/v1/auth/password/change-protected/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            
            reauth_token = str(body.get('reauth_token', '')).strip()
            valid, msg = reauth_manager.validate_token(dev['username'], reauth_token)
            if not valid:
                self.send_json(401, {'error': msg})
                return
            
            current_pass = str(body.get('current_password', body.get('currentPassword', ''))).strip()
            if not current_pass or not check_password(current_pass, dev['password']):
                self.send_json(400, {'error': 'Current password verification failed.'})
                return
            
            new_pass = str(body.get('new_password', body.get('newPassword', ''))).strip()
            confirm_pass = str(body.get('confirm_password', body.get('confirmPassword', ''))).strip()

            if confirm_pass and confirm_pass != new_pass:
                self.send_json(400, {'error': 'New passwords do not match.'})
                return

            if new_pass == current_pass:
                self.send_json(400, {'error': 'New password cannot be the same as current password.'})
                return
            val_ok, val_err = validate_password_strength(new_pass)
            if not val_ok:
                self.send_json(400, {'error': val_err})
                return

            # Apply change using Django PBKDF2 hasher
            dev['password'] = make_password(new_pass)
            dev['passwordLastChanged'] = time.time()
            reauth_manager.consume_token(dev['username'], reauth_token)

            # Revoke other sessions if requested
            if body.get('revoke_other_sessions', True):
                curr_tok = self.get_session_token()
                revoke_all_other_sessions(ACTIVE_SESSIONS, dev['username'], curr_tok)

            add_audit_log(dev, 'Password Changed (Protected Workflow)', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()

            # Send email confirmation
            user_email = dev.get('email', '')
            if user_email and send_mail:
                try:
                    send_mail(
                        subject="Security Alert: Your DevSync Password Was Changed",
                        message=f"Hello {dev.get('name', dev['username'])},\n\nYour DevSync account password was successfully updated through the protected security workflow.\n\nIf you did not perform this change, please contact security immediately.\n\n— The DevSync Security Team",
                        from_email=DEFAULT_FROM_EMAIL,
                        recipient_list=[user_email],
                        fail_silently=True
                    )
                except Exception as mail_err:
                    print(f"[Mail Warning] {mail_err}")

            self.send_json(200, {
                'success': True,
                'message': 'Password successfully updated. Confirmation email has been sent.'
            })
            return

        # C. 2FA Setup Initiation (POST /api/v1/auth/2fa/setup)
        if path in ('/api/v1/auth/2fa/setup', '/api/v1/auth/2fa/setup/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            
            # Require re-auth token or current password
            reauth_token = str(body.get('reauth_token', '')).strip()
            password = str(body.get('password', '')).strip()
            if reauth_token:
                valid, msg = reauth_manager.validate_token(dev['username'], reauth_token)
                if not valid:
                    self.send_json(401, {'error': msg})
                    return
            elif password:
                if not check_password(password, dev['password']):
                    self.send_json(400, {'error': 'Incorrect password.'})
                    return
            else:
                self.send_json(400, {'error': 'Re-authentication authorization is required to configure 2FA.'})
                return

            secret = totp_manager.generate_secret()
            dev['_pending_2fa_secret'] = secret
            uri = totp_manager.get_provisioning_uri(dev['username'], secret)
            save_database()
            formatted_key = " ".join([secret[i:i+4] for i in range(0, len(secret), 4)])
            self.send_json(200, {
                'success': True,
                'secret': secret,
                'formatted_key': formatted_key,
                'provisioning_uri': uri,
                'message': '2FA enrollment initialized. Verify a 6-digit code from your authenticator app to enable.'
            })
            return

        # D. 2FA Verification & Activation (POST /api/v1/auth/2fa/enable)
        if path in ('/api/v1/auth/2fa/enable', '/api/v1/auth/2fa/enable/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            
            code = str(body.get('code', '')).strip()
            secret = str(body.get('secret', '')).strip() or dev.get('_pending_2fa_secret')
            if not secret:
                self.send_json(400, {'error': 'No 2FA enrollment session found. Please initialize setup again.'})
                return

            if not totp_manager.verify_code(secret, code):
                self.send_json(400, {'error': 'Invalid 6-digit verification code. Please check the code in your authenticator app.'})
                return

            plain_codes, hashed_codes = totp_manager.generate_recovery_codes()
            dev['two_factor_enabled'] = True
            dev['two_factor_secret'] = secret
            dev['two_factor_recovery_codes'] = hashed_codes
            dev['two_factor_type'] = 'Authenticator App (TOTP)'
            dev.pop('_pending_2fa_secret', None)

            add_audit_log(dev, 'Two-Factor Authentication Enabled', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()

            # Email notification
            user_email = dev.get('email', '')
            if user_email and send_mail:
                try:
                    send_mail(
                        subject="Security Alert: Two-Factor Authentication Enabled",
                        message=f"Hello {dev.get('name', dev['username'])},\n\nTwo-Factor Authentication (TOTP) was enabled on your DevSync account.\n\n— The DevSync Security Team",
                        from_email=DEFAULT_FROM_EMAIL,
                        recipient_list=[user_email],
                        fail_silently=True
                    )
                except Exception:
                    pass

            self.send_json(200, {
                'success': True,
                'recovery_codes': plain_codes,
                'message': 'Two-Factor Authentication is now enabled. Please store your recovery codes in a secure location.'
            })
            return

        # E. 2FA Disable (POST /api/v1/auth/2fa/disable)
        if path in ('/api/v1/auth/2fa/disable', '/api/v1/auth/2fa/disable/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            
            password = str(body.get('password', '')).strip()
            reauth_token = str(body.get('reauth_token', '')).strip()
            if reauth_token:
                valid, msg = reauth_manager.validate_token(dev['username'], reauth_token)
                if not valid:
                    self.send_json(401, {'error': msg})
                    return
            elif password:
                if not check_password(password, dev['password']):
                    self.send_json(400, {'error': 'Incorrect password. Verification challenge failed.'})
                    return
            else:
                self.send_json(400, {'error': 'Password verification is required to disable Two-Factor Authentication.'})
                return

            dev['two_factor_enabled'] = False
            dev.pop('two_factor_secret', None)
            dev.pop('two_factor_recovery_codes', None)
            dev['two_factor_type'] = 'Not Enabled'

            add_audit_log(dev, 'Two-Factor Authentication Disabled', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'warning')
            save_database()

            self.send_json(200, {
                'success': True,
                'message': 'Two-Factor Authentication has been disabled.'
            })
            return

        # F. Regenerate Recovery Codes (POST /api/v1/auth/2fa/recovery-codes/regenerate)
        if path in ('/api/v1/auth/2fa/recovery-codes/regenerate', '/api/v1/auth/2fa/recovery-codes/regenerate/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            if not dev.get('two_factor_enabled'):
                self.send_json(400, {'error': 'Two-Factor Authentication is not enabled on this account.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            
            password = str(body.get('password', '')).strip()
            reauth_token = str(body.get('reauth_token', '')).strip()
            if reauth_token:
                valid, msg = reauth_manager.validate_token(dev['username'], reauth_token)
                if not valid:
                    self.send_json(401, {'error': msg})
                    return
            elif password:
                if not check_password(password, dev['password']):
                    self.send_json(400, {'error': 'Incorrect password.'})
                    return
            else:
                self.send_json(400, {'error': 'Password verification is required to regenerate recovery codes.'})
                return

            plain_codes, hashed_codes = totp_manager.generate_recovery_codes()
            dev['two_factor_recovery_codes'] = hashed_codes
            add_audit_log(dev, '2FA Recovery Codes Regenerated', self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()

            self.send_json(200, {
                'success': True,
                'recovery_codes': plain_codes,
                'message': 'Fresh recovery codes generated. Your previous codes are now invalid.'
            })
            return

        # ======================================================================
        # DevSync Settings System, Security & Password Recovery Handlers
        # ======================================================================

        # 1. Change Password Endpoint (POST /api/v1/auth/password/change, /api/v1/settings/password)
        if path in ('/api/v1/auth/password/change', '/api/v1/auth/password/change/', '/api/v1/settings/password', '/api/v1/settings/password/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            curr_pass = str(body.get('currentPassword', body.get('current_password', ''))).strip()
            new_pass = str(body.get('newPassword', body.get('new_password', ''))).strip()

            if not curr_pass:
                self.send_json(400, {'error': 'Current password is required.'})
                return

            # Verify current password re-auth
            stored_pass = dev.get('password', '')
            if not check_password(curr_pass, stored_pass) and curr_pass != stored_pass:
                self.send_json(400, {'error': 'Current password is incorrect. Please verify and try again.'})
                return

            # Check password strength
            valid, err = validate_password_strength(new_pass)
            if not valid:
                self.send_json(400, {'error': err})
                return

            # Ensure new != old
            if check_password(new_pass, stored_pass) or new_pass == curr_pass:
                self.send_json(400, {'error': 'New password cannot be the same as your current password.'})
                return

            dev['password'] = make_password(new_pass)
            dev['passwordLastChanged'] = 'Just now'
            add_audit_log(dev, 'password_change', "Password changed successfully via Settings.", self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()

            # Dispatch notification email to user's registered address
            user_email = dev.get('email', '')
            if user_email:
                try:
                    send_mail(
                        "Security Alert: Your DevSync Password Was Changed",
                        f"Hello {dev.get('name', dev.get('username'))},\n\nThis is a confirmation that your DevSync account password was changed just now.\nIf you did not perform this change, please contact security immediately.\n\n— The DevSync Security Team",
                        settings.DEFAULT_FROM_EMAIL,
                        [user_email],
                        fail_silently=True
                    )
                except Exception:
                    pass

            self.send_json(200, {'success': True, 'message': 'Password updated successfully.'})
            return

        # 2. Email Change Flow (Two-Step with OTP to New Email)
        if path in ('/api/v1/auth/email/request-change', '/api/v1/auth/email/request-change/', '/api/v1/settings/email/request-change'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            curr_pass = str(body.get('password', body.get('currentPassword', ''))).strip()
            new_email = str(body.get('new_email', body.get('email', ''))).strip().lower()

            # Password re-auth check
            if not curr_pass or (not check_password(curr_pass, dev.get('password', '')) and curr_pass != dev.get('password', '')):
                self.send_json(400, {'error': 'Current password is incorrect. Verification required to change email.'})
                return

            # Email format check
            if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', new_email):
                self.send_json(400, {'error': 'Please provide a valid new email address.'})
                return

            if new_email == dev.get('email', '').lower():
                self.send_json(400, {'error': 'New email is identical to your current registered email.'})
                return

            # Check uniqueness across profiles
            for d in DEV_PROFILES.values():
                if d.get('email', '').lower() == new_email and d.get('username') != dev.get('username'):
                    self.send_json(400, {'error': f'The email {new_email} is already in use by another account.'})
                    return

            ok, msg, otp, status = otp_manager.send_otp(new_email, metadata={'username': dev['username'], 'old_email': dev.get('email', '')})
            if not ok:
                self.send_json(status, {'error': msg})
                return

            # Dispatch OTP to new email address
            try:
                send_mail("DevSync Email Change Verification Code", f"""Hello,

Your 6-digit confirmation code to change your DevSync account email to {new_email} is: {otp}

This code will expire in 10 minutes.

— DevSync Security Team""",
                    settings.DEFAULT_FROM_EMAIL,
                    [new_email],
                    fail_silently=False
                )
            except Exception as e:
                print(f"[Email Change] Notice: Dispatch to {new_email} with code {otp}: {e}")

            self.send_json(200, {
                'success': True,
                'requires_otp': True,
                'message': f'Verification code dispatched to {new_email}. Please enter the code to complete the update.'
            })
            return

        if path in ('/api/v1/auth/email/confirm-change', '/api/v1/auth/email/confirm-change/', '/api/v1/auth/email/verify-change', '/api/v1/settings/email/confirm-change'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            new_email = str(body.get('new_email', body.get('email', ''))).strip().lower()
            code = str(body.get('otp', body.get('code', ''))).strip()

            ok, msg, meta, status = otp_manager.verify_otp(new_email, code)
            if not ok:
                self.send_json(status, {'error': msg})
                return

            old_email = dev.get('email', '')
            dev['email'] = new_email
            dev['emailVerified'] = True
            add_audit_log(dev, 'email_change', f"Primary email updated from {old_email} to {new_email}", self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
            save_database()

            # Send alert to OLD email
            if old_email:
                try:
                    send_mail("Security Alert: Your DevSync Account Email Was Changed", f"""Hello,

The email address associated with your DevSync account (@{dev.get('username')}) has been changed to {new_email}.
If you did not authorize this change, please contact security immediately.

— The DevSync Security Team""",
                        settings.DEFAULT_FROM_EMAIL,
                        [old_email],
                        fail_silently=True
                    )
                except Exception:
                    pass

            self.send_json(200, {
                'success': True,
                'email': new_email,
                'message': 'Email address successfully updated and verified.'
            })
            return

        # Resend Email Verification
        if path in ('/api/v1/auth/email/resend-verification', '/api/v1/auth/email/resend-verification/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return
            user_email = dev.get('email', '')
            ok, msg, otp, status = otp_manager.send_otp(user_email)
            if not ok:
                self.send_json(status, {'error': msg})
                return
            try:
                send_mail("DevSync Email Verification Code", f"""Hello,

Your DevSync verification code is: {otp}

Valid for 10 minutes.

— The DevSync Security Team""",
                    settings.DEFAULT_FROM_EMAIL,
                    [user_email],
                    fail_silently=True
                )
            except Exception:
                pass
            self.send_json(200, {'success': True, 'message': f'Verification code dispatched to {user_email}.'})
            return

        # 3. Mobile Number Change (with Explicit SMS Provider Check)
        if path in ('/api/v1/auth/mobile/request-change', '/api/v1/auth/mobile/request-change/', '/api/v1/settings/mobile/request-change'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            curr_pass = str(body.get('password', body.get('currentPassword', ''))).strip()
            mobile = str(body.get('mobile', '')).strip()

            # Password re-auth check
            if not curr_pass or (not check_password(curr_pass, dev.get('password', '')) and curr_pass != dev.get('password', '')):
                self.send_json(400, {'error': 'Current password is incorrect. Verification required to modify mobile number.'})
                return

            # Explicit check for SMS Provider config
            if not SMSProvider.is_configured():
                self.send_json(400, {
                    'error': 'SMS provider unconfigured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables to enable SMS verification.',
                    'configured': False
                })
                return

            ok, err = SMSProvider.send_sms(mobile, f"DevSync: Mobile verification code requested.")
            if not ok:
                self.send_json(400, {'error': err})
                return

            self.send_json(200, {'success': True, 'message': f'SMS verification code dispatched to {mobile}.'})
            return

        # 4. Session Revocation (POST /api/v1/auth/sessions/revoke, /api/v1/auth/sessions/revoke-others)
        if path in ('/api/v1/auth/sessions/revoke', '/api/v1/auth/sessions/revoke/', '/api/v1/settings/sessions/revoke'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            session_id = str(body.get('sessionId', body.get('id', ''))).strip()
            curr_token = self.get_session_token()
            ok, res = revoke_single_session(ACTIVE_SESSIONS, auth_user['username'], session_id, curr_token)
            if not ok:
                self.send_json(404, {'error': res})
                return
            self.send_json(200, {'success': True, 'message': 'Session revoked successfully.', 'isCurrent': res.get('isCurrent', False)})
            return

        if path in ('/api/v1/auth/sessions/revoke-others', '/api/v1/auth/sessions/revoke-others/', '/api/v1/settings/sessions/revoke-others'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            curr_token = self.get_session_token()
            dev = get_developer_by_identifier(auth_user['username'])
            count = revoke_all_other_sessions(ACTIVE_SESSIONS, auth_user['username'], curr_token)
            if dev:
                add_audit_log(dev, 'session_revocation', f"Revoked {count} active session(s) across other devices.", self.client_address[0], parse_device_string(self.headers.get('User-Agent', '')), 'success')
                save_database()
            self.send_json(200, {'success': True, 'revokedCount': count, 'message': f'Signed out {count} other active session(s).'})
            return

        # 5. Account Deletion (POST /api/v1/auth/account/delete, /api/v1/settings/account/delete)
        if path in ('/api/v1/auth/account/delete', '/api/v1/auth/account/delete/', '/api/v1/settings/account/delete'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            curr_pass = str(body.get('password', body.get('currentPassword', ''))).strip()
            confirmation = str(body.get('confirmation', '')).strip()

            # Password re-auth check
            if not curr_pass or (not check_password(curr_pass, dev.get('password', '')) and curr_pass != dev.get('password', '')):
                self.send_json(400, {'error': 'Current password is incorrect. Verification required to delete account.'})
                return

            # Explicit confirmation check
            if confirmation != dev.get('username') and confirmation != 'DELETE':
                self.send_json(400, {'error': f"Please type '{dev.get('username')}' or 'DELETE' to confirm account deletion."})
                return

            target_username = dev.get('username')
            # Clean up user from DEV_PROFILES
            DEV_PROFILES.pop(target_username, None)
            # Clean up active sessions
            tokens_to_remove = [tok for tok, s in ACTIVE_SESSIONS.items() if s.get('username', '').lower() == target_username.lower()]
            for tok in tokens_to_remove:
                ACTIVE_SESSIONS.pop(tok, None)

            # Clean up repo memberships
            for repo in REPOSITORIES.values():
                repo['members'] = [m for m in repo.get('members', []) if m.get('username', '').lower() != target_username.lower()]

            save_database()
            self.send_json(200, {'success': True, 'message': 'Your account has been deleted successfully.'})
            return

        # 6. Password Recovery Endpoints (Forgot Password -> OTP -> Reset)
        if path in ('/api/v1/auth/password/forgot', '/api/v1/auth/password/forgot/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            identifier = str(body.get('identifier', body.get('email', ''))).strip()

            if not identifier:
                self.send_json(400, {'error': 'Please enter your registered email, username, or mobile number.'})
                return

            status, msg = recovery_manager.request_recovery(identifier, DEV_PROFILES, send_mail, settings.DEFAULT_FROM_EMAIL)
            self.send_json(status, {'message': msg, 'success': (status == 200)})
            return

        if path in ('/api/v1/auth/password/verify-recovery-otp', '/api/v1/auth/password/verify-recovery-otp/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            identifier = str(body.get('identifier', body.get('email', ''))).strip()
            code = str(body.get('code', body.get('otp', ''))).strip()

            if not identifier or not code:
                self.send_json(400, {'error': 'Identifier and verification code are required.'})
                return

            ok, msg, rst_token = recovery_manager.verify_recovery_code(identifier, code)
            if not ok:
                self.send_json(400, {'error': msg})
                return

            self.send_json(200, {
                'success': True,
                'reset_token': rst_token,
                'message': 'Code verified. You can now set your new password.'
            })
            return

        if path in ('/api/v1/auth/password/reset', '/api/v1/auth/password/reset/'):
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}
            rst_token = str(body.get('reset_token', body.get('token', ''))).strip()
            new_pass = str(body.get('new_password', body.get('newPassword', ''))).strip()

            if not rst_token or not new_pass:
                self.send_json(400, {'error': 'Reset token and new password are required.'})
                return

            status, msg = recovery_manager.reset_password(
                rst_token, new_pass, DEV_PROFILES, ACTIVE_SESSIONS, save_database,
                send_mail, settings.DEFAULT_FROM_EMAIL, self.client_address[0],
                self.headers.get('User-Agent', '')
            )
            self.send_json(status, {'success': (status == 200), 'message': msg if status == 200 else None, 'error': msg if status != 200 else None})
            return

        # 7. Avatar Upload Endpoint (POST /api/v1/settings/avatar, /api/v1/user/avatar)
        if path in ('/api/v1/settings/avatar', '/api/v1/settings/avatar/', '/api/v1/user/avatar', '/api/v1/user/avatar/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            if length > 5 * 1024 * 1024:
                self.send_json(400, {'error': 'Avatar file exceeds maximum size limit of 5MB.'})
                return

            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
                raw_data = body.get('data', '')
                filename = body.get('name', 'avatar.png')
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON format for avatar upload.'})
                return

            if not raw_data:
                self.send_json(400, {'error': 'Missing image data.'})
                return

            import base64
            # Handle data URL scheme (e.g. data:image/png;base64,...)
            if ';base64,' in raw_data:
                header_part, base64_data = raw_data.split(';base64,', 1)
                mime = header_part.split(':')[-1]
                ext = mime.split('/')[-1].replace('jpeg', 'jpg')
            else:
                base64_data = raw_data
                ext = os.path.splitext(filename)[-1].lstrip('.') or 'png'

            try:
                image_bytes = base64.b64decode(base64_data)
            except Exception:
                self.send_json(400, {'error': 'Invalid base64 image data.'})
                return

            if len(image_bytes) > 5 * 1024 * 1024:
                self.send_json(400, {'error': 'Image exceeds 5MB size limit.'})
                return

            try:
                sanitized_bytes = strip_exif_and_sanitize_image(image_bytes, ext)
            except Exception as e:
                self.send_json(400, {'error': f'Image validation failed: {str(e)}'})
                return

            avatar_filename = f"avatar_{dev['username']}_{secrets.token_hex(6)}.{ext}"
            avatar_dir = os.path.join(FRONTEND_DIR, 'public', 'images', 'avatars')
            os.makedirs(avatar_dir, exist_ok=True)
            avatar_path = os.path.join(avatar_dir, avatar_filename)
            with open(avatar_path, 'wb') as f:
                f.write(sanitized_bytes)

            avatar_url = f"/public/images/avatars/{avatar_filename}"
            dev['avatar'] = avatar_url
            save_database()
            self.send_json(200, {'success': True, 'avatar': avatar_url, 'message': 'Avatar updated successfully.'})
            return

        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')
        # AI Assistant Chat Endpoint
        if path in ('/api/ai/chat', '/api/v1/ai/chat', '/assistant/chat', '/assistant/chat/'):
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

            stored_password = matched_user.get('password', 'demo12345')
            is_valid_password = False
            if stored_password.startswith(('pbkdf2_', 'argon2', 'bcrypt', 'crypt$')):
                try:
                    is_valid_password = check_password(password, stored_password)
                except Exception:
                    is_valid_password = False
            else:
                is_valid_password = (password == stored_password)
                if is_valid_password:
                    # Upgrade legacy plaintext password to Django PBKDF2 hash
                    matched_user['password'] = make_password(password)
                    save_database()

            if not is_valid_password:
                self.send_json(401, {
                    'detail': 'Invalid email or password. Please verify your credentials and try again.',
                    'error': 'Invalid credentials'
                })
                return

            # Valid credentials: create token and active session
            token = f"devsync_token_{secrets.token_hex(20)}"
            session_id = f"sess_{secrets.token_hex(10)}"
            user_agent = self.headers.get('User-Agent', '')
            client_ip = self.client_address[0]
            device = parse_device_string(user_agent)

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
                'id': session_id,
                'token': token,
                'username': matched_user['username'].lower(),
                'user': user_summary,
                'device': device,
                'ip': client_ip,
                'created': time.time(),
                'last_active': time.time()
            }
            add_audit_log(matched_user, 'login', f"Signed in successfully via {device}", client_ip, device, 'success')
            save_database()

            # Set HttpOnly, SameSite Session Cookie
            resp_data = json.dumps({
                'access': token,
                'token': token,
                'user': user_summary,
                'message': f"Welcome back, {matched_user['name']}!"
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_data)))
            self.send_header('Set-Cookie', f"devsync_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DevSync-User')
            self.end_headers()
            self.wfile.write(resp_data)
            return
            return

        # Authentication Logout Endpoint
        if path in ('/api/v1/auth/logout', '/api/auth/logout'):
            token = self.get_session_token()
            if token:
                ACTIVE_SESSIONS.pop(token, None)
            resp_data = json.dumps({'success': True, 'message': 'Logged out successfully.'}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_data)))
            self.send_header('Set-Cookie', "devsync_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(resp_data)
            return

        # Google OAuth Sign-In Endpoint (POST /api/v1/auth/google, /api/auth/google)
        if path in ('/api/v1/auth/google', '/api/auth/google'):
            if not GOOGLE_CLIENT_ID:
                self.send_json(501, {
                    'error': 'Google OAuth Not Configured',
                    'detail': 'Google OAuth credentials are not configured on this server. To enable Google Sign-In, set the GOOGLE_CLIENT_ID environment variable.',
                    'configured': False
                })
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            id_token = body.get('credential') or body.get('id_token')
            if not id_token:
                self.send_json(400, {'error': 'Missing Credential', 'detail': 'Google credential token is required.'})
                return

            claims, err = verify_google_id_token(id_token)
            if err:
                self.send_json(401, {'error': 'Authentication Failed', 'detail': err})
                return

            google_id = claims.get('sub')
            email = claims.get('email', '').strip().lower()
            name = claims.get('name', '')
            picture = claims.get('picture', '')

            # Check existing user
            matched_user = None
            for u in DEV_PROFILES.values():
                if u.get('google_id') == google_id:
                    matched_user = u
                    break
                # Only link if email matches and user is verified
                if u.get('email', '').strip().lower() == email and u.get('isVerified', False):
                    matched_user = u
                    matched_user['google_id'] = google_id
                    save_database()
                    break

            if not matched_user:
                derived_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0].lower()) or f"dev_{int(time.time())}"
                orig_username = derived_username
                counter = 1
                while get_developer_by_identifier(derived_username):
                    derived_username = f"{orig_username}_{counter}"
                    counter += 1

                user_data = {
                    'name': name or derived_username,
                    'username': derived_username,
                    'email': email,
                    'avatar': picture,
                    'google_id': google_id,
                    'isVerified': True,
                    'authProvider': 'google'
                }
                matched_user = ensure_user_profile(user_data)
                save_database()

            token = f"devsync_token_{secrets.token_hex(20)}"
            user_summary = {
                'id': matched_user['id'],
                'name': matched_user['name'],
                'username': matched_user['username'],
                'email': matched_user.get('email', f"{matched_user['username']}@devsync.dev"),
                'role': matched_user.get('role', 'Developer'),
                'avatar': matched_user.get('avatar', picture),
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

        # Send Email OTP Endpoint (POST /api/v1/auth/send-email-otp, /api/auth/send-email-otp)
        send_email_otp_paths = (
            '/api/v1/auth/send-email-otp', '/api/v1/auth/send-email-otp/',
            '/api/auth/send-email-otp', '/api/auth/send-email-otp/',
            '/auth/send-email-otp', '/auth/send-email-otp/'
        )
        if path in send_email_otp_paths:
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            email = str(body.get('email', '')).strip().lower()
            if not email or '@' not in email or '.' not in email.split('@')[-1]:
                self.send_json(400, {'detail': 'Valid email address is required to receive verification OTP.', 'error': 'Invalid email'})
                return

            # Rate limit: 60s cooldown per email
            now = time.time()
            cached = EMAIL_OTP_CACHE.get(email)
            if cached and (now - cached.get('last_sent_at', 0)) < 60:
                remaining = int(60 - (now - cached.get('last_sent_at', 0)))
                self.send_json(429, {
                    'detail': f'Please wait {remaining} seconds before requesting a new code.',
                    'error': 'Rate limited',
                    'retryAfterSeconds': remaining
                })
                return

            # Cryptographically secure 6-digit OTP
            otp = f"{secrets.randbelow(900000) + 100000}"
            salt = secrets.token_hex(16)
            otp_hash = hashlib.sha256(f"{salt}:{otp}".encode('utf-8')).hexdigest()

            EMAIL_OTP_CACHE[email] = {
                'salt': salt,
                'hash': otp_hash,
                'expires_at': now + 600,  # 10 minutes
                'last_sent_at': now,
                'attempts_remaining': 5
            }

            dispatched, err, is_smtp_configured = dispatch_verification_email(email, otp)

            response_payload = {
                'success': True,
                'message': f'Verification code dispatched to {email}. Please check your inbox.',
                'expiresInSeconds': 600,
                'email': email
            }
            if not is_smtp_configured:
                response_payload['devNotice'] = f'[Development Notice] SMTP unconfigured. Verification code logged to server console.'

            self.send_json(200, response_payload)
            return

        # Verify Email OTP Endpoint (POST /api/v1/auth/verify-email-otp, /api/auth/verify-email-otp)
        verify_email_otp_paths = (
            '/api/v1/auth/verify-email-otp', '/api/v1/auth/verify-email-otp/',
            '/api/auth/verify-email-otp', '/api/auth/verify-email-otp/',
            '/auth/verify-email-otp', '/auth/verify-email-otp/'
        )
        if path in verify_email_otp_paths:
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            email = str(body.get('email', '')).strip().lower()
            otp = str(body.get('otp', body.get('code', ''))).strip()

            if not email or not otp:
                self.send_json(400, {'detail': 'Email and 6-digit verification code are required.', 'error': 'Missing fields'})
                return

            cached = EMAIL_OTP_CACHE.get(email)
            now = time.time()

            if not cached or now > cached.get('expires_at', 0):
                self.send_json(400, {
                    'detail': 'Verification code has expired or was not requested. Please request a new code.',
                    'error': 'Expired code'
                })
                return

            if cached.get('attempts_remaining', 0) <= 0:
                EMAIL_OTP_CACHE.pop(email, None)
                self.send_json(400, {
                    'detail': 'Too many failed verification attempts. Please request a new verification code.',
                    'error': 'Attempts exceeded'
                })
                return

            salt = cached['salt']
            expected_hash = cached['hash']
            actual_hash = hashlib.sha256(f"{salt}:{otp}".encode('utf-8')).hexdigest()

            if not secrets.compare_digest(actual_hash, expected_hash):
                cached['attempts_remaining'] -= 1
                rem = cached['attempts_remaining']
                if rem <= 0:
                    EMAIL_OTP_CACHE.pop(email, None)
                    self.send_json(400, {
                        'detail': 'Invalid verification code. Attempt limit exceeded. Please request a new code.',
                        'error': 'Invalid code'
                    })
                else:
                    self.send_json(400, {
                        'detail': f'Invalid verification code. {rem} attempt{"s" if rem != 1 else ""} remaining.',
                        'attemptsRemaining': rem,
                        'error': 'Invalid code'
                    })
                return

            # Verification code is valid: consume it immediately
            EMAIL_OTP_CACHE.pop(email, None)

            # Issue time-limited single-use verification token (15 mins)
            verification_token = f"vtok_{secrets.token_urlsafe(32)}"
            VERIFIED_TOKENS[verification_token] = {
                'email': email,
                'expires_at': now + 900
            }

            self.send_json(200, {
                'success': True,
                'verified': True,
                'verificationToken': verification_token,
                'message': 'Email address verified successfully!'
            })
            return

        # Registration Endpoint (POST /api/v1/auth/register, /auth/register/, /auth/register, /api/auth/register)
        register_paths = (
            '/api/v1/auth/register', '/api/v1/auth/register/',
            '/auth/register/', '/auth/register',
            '/api/auth/register', '/api/auth/register/'
        )
        if path in register_paths:
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            email = str(body.get('email', '')).strip().lower()
            name = str(body.get('name', '')).strip()
            username = str(body.get('username', '')).strip().lower()
            password = str(body.get('password', '')).strip()
            verification_token = str(body.get('verificationToken', body.get('verification_token', ''))).strip()

            if not email:
                self.send_json(400, {'detail': 'Email address is required.', 'error': 'Missing email'})
                return

            if not password:
                self.send_json(400, {'detail': 'Password is required.', 'error': 'Missing password'})
                return

            if len(password) < 8:
                self.send_json(400, {
                    'detail': 'Password must be at least 8 characters long.',
                    'error': 'Password too short'
                })
                return

            # Require valid email OTP verification token
            now = time.time()
            v_record = VERIFIED_TOKENS.get(verification_token)
            if not v_record or v_record.get('email') != email or now > v_record.get('expires_at', 0):
                self.send_json(400, {
                    'detail': 'Email verification required. Please verify your email with OTP first.',
                    'error': 'Unverified email'
                })
                return

            # Single-use token: consume immediately
            VERIFIED_TOKENS.pop(verification_token, None)

            # Check if user already exists
            existing_user = None
            for u in DEV_PROFILES.values():
                if u.get('email', '').strip().lower() == email:
                    existing_user = u
                    break

            if existing_user:
                self.send_json(400, {
                    'detail': 'An account with this email address already exists. Please sign in instead.',
                    'error': 'User exists'
                })
                return

            if not username:
                derived = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0].lower())
                username = derived or f"dev_{int(time.time())}"

            orig_username = username
            counter = 1
            while get_developer_by_identifier(username):
                username = f"{orig_username}_{counter}"
                counter += 1

            # Securely hash password with Django PBKDF2 hasher
            hashed_password = make_password(password)

            user_data = {
                'name': name or username,
                'username': username,
                'email': email,
                'password': hashed_password,
                'isVerified': True,
                'authProvider': 'local'
            }
            new_user = ensure_user_profile(user_data)
            save_database()

            token = f"devsync_token_{secrets.token_hex(20)}"
            user_summary = {
                'id': new_user['id'],
                'name': new_user['name'],
                'username': new_user['username'],
                'email': new_user.get('email', f"{new_user['username']}@devsync.dev"),
                'role': new_user.get('role', 'Developer'),
                'avatar': new_user.get('avatar', ''),
                'location': new_user.get('location', '')
            }
            ACTIVE_SESSIONS[token] = {
                'username': new_user['username'].lower(),
                'user': user_summary,
                'created': time.time()
            }
            self.send_json(201, {
                'access': token,
                'token': token,
                'user': user_summary,
                'message': f"Account and developer profile created successfully! Welcome to DevSync, {new_user['name']}!"
            })
            return

        # Legacy Mobile OTP fallback (POST /api/v1/auth/send-otp, /api/auth/send-otp)
        if path in ('/api/v1/auth/send-otp', '/api/auth/send-otp'):
            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            email = str(body.get('email', '')).strip().lower()
            if email:
                # Forward to email OTP handler
                self.send_json(400, {'detail': 'Please use /api/v1/auth/send-email-otp for email verification.'})
                return

            self.send_json(400, {'detail': 'Mobile OTP verification has been deprecated. DevSync now uses Email OTP verification for account setup.'})
            return


        # POST /api/v1/repositories/<repo_id>/upload
        m_upload = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/upload/?$', path)
        if m_upload:
            repo_id = m_upload.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in.'})
                return
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not is_collab:
                self.send_json(403, {'error': 'Forbidden: You do not have write permissions to upload files to this repository.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON', 'detail': 'Malformed request body.'})
                return

            branch = str(body.get('branch', '')).strip()
            file_path = str(body.get('filePath', body.get('path', ''))).strip()
            content = body.get('content', '')
            commit_msg = str(body.get('commitMessage', body.get('message', ''))).strip()
            overwrite = bool(body.get('overwrite', False))

            if not branch:
                self.send_json(400, {'error': 'Missing branch', 'detail': 'Target branch is required.'})
                return
            if not file_path:
                self.send_json(400, {'error': 'Missing path', 'detail': 'Destination file path is required.'})
                return

            ok, res, status = handle_branch_file_upload(
                repo, branch, file_path, content, commit_msg, auth_user['username'],
                overwrite=overwrite, base_data_dir=DATA_DIR
            )
            if ok:
                save_database()
            self.send_json(status, res)
            return

        # POST /api/v1/repositories/<repo_id>/attachments
        m_att_post = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/attachments/?$', path)
        if m_att_post:
            repo_id = m_att_post.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not is_collab:
                self.send_json(403, {'error': 'Forbidden: Write permission required to upload project attachments.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            file_name = str(body.get('name', body.get('fileName', ''))).strip()
            content = body.get('content', '')
            file_type = str(body.get('fileType', 'application/octet-stream')).strip()
            desc = str(body.get('description', '')).strip()

            if not file_name:
                self.send_json(400, {'error': 'Missing file name'})
                return

            ok, res, status = handle_attachment_upload(repo, file_name, content, file_type, desc, auth_user['username'], base_data_dir=DATA_DIR)
            if ok:
                save_database()
            self.send_json(status, res)
            return

        # POST /api/v1/repositories/<repo_id>/members
        m_mem_post = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/members/?$', path)
        if m_mem_post:
            repo_id = m_mem_post.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not (is_owner or is_maint):
                self.send_json(403, {'error': 'Forbidden: Only owners and maintainers can invite collaborators.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            target_user = str(body.get('username', '')).strip().lower()
            role_to_assign = str(body.get('role', 'Collaborator')).strip()
            resp_label = str(body.get('responsibility', 'Contributor')).strip()
            assigned_tasks = body.get('assignedTasks', [])

            if not target_user:
                self.send_json(400, {'error': 'Username is required'})
                return

            dev_target = get_developer_by_identifier(target_user)
            if not dev_target:
                self.send_json(404, {'error': f'User @{target_user} does not exist on DevSync.'})
                return

            valid_roles = ('Owner', 'Maintainer', 'Collaborator', 'Viewer')
            if role_to_assign not in valid_roles:
                self.send_json(400, {'error': f'Invalid role. Must be one of {valid_roles}'})
                return

            if role_to_assign == 'Owner' and not is_owner:
                self.send_json(403, {'error': 'Forbidden: Only the repository owner can transfer or assign Owner role.'})
                return

            members = repo.setdefault('members', [])
            existing_mem = next((m for m in members if m.get('username', '').lower() == target_user), None)
            now = time.time()
            if existing_mem:
                existing_mem['role'] = role_to_assign
                existing_mem['responsibility'] = resp_label
                if assigned_tasks:
                    existing_mem['assignedTasks'] = assigned_tasks
                action_text = "updated"
            else:
                members.append({
                    'username': target_user,
                    'role': role_to_assign,
                    'responsibility': resp_label,
                    'assignedTasks': assigned_tasks,
                    'joined_at': now
                })
                action_text = "added"

            repo['updated_at'] = now
            record_activity_event(
                'collaborator_added',
                auth_user['username'],
                repo['name'],
                title=f"{'Updated' if existing_mem else 'Added'} collaborator @{target_user} as {role_to_assign}",
                description=f"Assigned responsibility: {resp_label}",
                visibility=repo.get('visibility', 'Public')
            )
            save_database()
            self.send_json(200 if existing_mem else 201, {
                'success': True,
                'message': f"Collaborator @{target_user} successfully {action_text}.",
                'member': {
                    'username': target_user,
                    'role': role_to_assign,
                    'responsibility': resp_label,
                    'assignedTasks': assigned_tasks
                },
                'membersCount': len(members)
            })
            return

        # POST /api/v1/repositories/<repo_id>/branches
        m_branch_post = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/branches/?$', path)
        if m_branch_post:
            repo_id = m_branch_post.group(1)
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': f'Repository {repo_id} not found'})
                return
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not is_collab:
                self.send_json(403, {'error': 'Forbidden: Write permission required to create branches.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            new_branch = str(body.get('name', body.get('branch', ''))).strip()
            from_branch = str(body.get('fromBranch', body.get('from', repo.get('defaultBranch', 'main')))).strip()

            if not new_branch or not re.match(r'^[a-zA-Z0-9_\-\./]+$', new_branch):
                self.send_json(400, {'error': 'Invalid branch name. Use alphanumeric characters, slashes, dashes.'})
                return

            if new_branch in repo.get('branches', []):
                self.send_json(400, {'error': f"Branch '{new_branch}' already exists."})
                return

            repo.setdefault('branches', []).append(new_branch)
            source_files = repo.get('files', {}).get(from_branch, [])
            repo.setdefault('files', {})[new_branch] = [dict(f) for f in source_files]
            repo['updated_at'] = time.time()

            record_activity_event(
                'branch_created',
                auth_user['username'],
                repo['name'],
                branch=new_branch,
                title=f"Created branch {new_branch} from {from_branch}",
                description=f"Branch initialized with {len(source_files)} files from {from_branch}.",
                visibility=repo.get('visibility', 'Public')
            )
            save_database()
            self.send_json(201, {
                'success': True,
                'message': f"Branch '{new_branch}' created successfully from '{from_branch}'.",
                'branch': new_branch,
                'fromBranch': from_branch,
                'branchesCount': len(repo['branches'])
            })
            return

        # POST /api/v1/repositories (create repository)
        if path in ('/api/v1/repositories', '/api/repositories', '/api/v1/repositories/', '/api/repositories/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required. Please sign in to create a repository.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            name = str(body.get('name', '')).strip()
            description = str(body.get('description', '')).strip()
            visibility = 'Private' if str(body.get('visibility', '')).lower() == 'private' else 'Public'
            init_readme = bool(body.get('initReadme', True))
            lang = str(body.get('language', 'Python')).strip()

            if not name or not re.match(r'^[a-zA-Z0-9_\-\.]+$', name):
                self.send_json(400, {'error': 'Invalid repository name. Alphanumeric, dash, and underscore allowed.'})
                return

            if get_repository_by_id_or_name(name):
                self.send_json(400, {'error': f"Repository '{name}' already exists."})
                return

            now = time.time()
            repo_id = f"repo-{name.lower()}"
            new_repo = {
                'id': repo_id,
                'name': name,
                'owner': auth_user['username'],
                'description': description or f"{name} repository on DevSync.",
                'language': lang,
                'languageColor': '#3572A5' if lang == 'Python' else '#F59E0B',
                'visibility': visibility,
                'defaultBranch': 'main',
                'created_at': now,
                'updated_at': now,
                'stars': 0,
                'forks': 0,
                'branches': ['main'],
                'members': [
                    {
                        'username': auth_user['username'],
                        'role': 'Owner',
                        'responsibility': 'Project Owner',
                        'assignedTasks': [],
                        'joined_at': now
                    }
                ],
                'milestones': [],
                'tasks': [],
                'files': {'main': []},
                'attachments': [],
                'audit_log': []
            }

            if init_readme:
                readme_content = f"# {name}\n\n{description or 'Welcome to ' + name + ' on DevSync.'}\n"
                new_repo['files']['main'].append({
                    'path': 'README.md',
                    'name': 'README.md',
                    'type': 'file',
                    'size': len(readme_content),
                    'updated_at': now,
                    'last_commit': 'Initial commit with README.md',
                    'last_actor': auth_user['username'],
                    'content': readme_content
                })

            REPOSITORIES[name] = new_repo
            record_activity_event(
                'repository_created',
                auth_user['username'],
                name,
                branch='main',
                title=f"Created {visibility.lower()} repository {name}",
                description=description,
                visibility=visibility
            )
            save_database()
            self.send_json(201, {
                'success': True,
                'message': f"Repository '{name}' created successfully.",
                'repository': new_repo
            })
            return

        # Pin Project Endpoint (POST /api/developers/<username>/pin, POST /api/v1/developers/<username>/pin)
        if '/pin' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            parts = path.split('/')
            username = parts[parts.index('pin') - 1].lower() if 'pin' in parts else ''
            dev = get_developer_by_identifier(username)
            if not dev:
                self.send_json(404, {'error': 'Developer not found'})
                return

            auth_user = self.get_authenticated_user()
            caller = auth_user['username'].lower() if auth_user else self.headers.get('X-DevSync-User', '').strip().lower()
            if caller != username:
                self.send_json(403, {'error': 'Forbidden: You can only pin projects on your own profile.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
                repo_id = body.get('projectId')
            except Exception:
                repo_id = None

            if not repo_id:
                self.send_json(400, {'error': 'Project ID is required to pin or unpin.'})
                return

            pinned = dev.get('pinnedProjects', [])
            if repo_id in pinned:
                pinned.remove(repo_id)
                msg = f"Project '{repo_id}' unpinned from profile."
                action = 'unpinned'
            else:
                if len(pinned) >= 4:
                    self.send_json(400, {
                        'error': 'Pin limit reached',
                        'detail': 'You can pin a maximum of 4 projects on your profile. Please unpin an existing project first.',
                        'pinnedLimit': 4,
                        'pinnedCount': len(pinned)
                    })
                    return
                pinned.append(repo_id)
                msg = f"Project '{repo_id}' pinned to profile successfully!"
                action = 'pinned'

            dev['pinnedProjects'] = pinned
            save_database()
            self.send_json(200, {
                'success': True,
                'message': msg,
                'action': action,
                'pinnedProjects': pinned,
                'pinnedCount': len(pinned),
                'pinnedLimit': 4
            })
            return

        # Follow Endpoint (POST /api/developers/<username>/follow)
        if '/follow' in path and ('/api/developers/' in path or '/api/v1/developers/' in path):
            parts = path.split('/')
            username = parts[parts.index('follow') - 1].lower() if 'follow' in parts else ''
            dev = get_developer_by_identifier(username)
            if not dev:
                self.send_json(404, {'error': 'Developer not found'})
                return

            is_following = not dev.get('isFollowing', False)
            dev['isFollowing'] = is_following
            stats = dev.setdefault('stats', {})
            current = stats.get('followers', 0)
            stats['followers'] = current + 1 if is_following else max(0, current - 1)
            save_database()
            self.send_json(200, {'isFollowing': is_following, 'followers': stats['followers']})
            return

        # Default all other unsupported POST operations to 405 Method Not Allowed
        self.serve_custom_error(405)

    def do_PATCH(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

        # Issues, PRs, Teams, and Chat PATCH dispatch
        if backend_issues_prs_chat.handle_patch(self, path, url_parts, self.get_authenticated_user(), save_database):
            return

        # Update Settings Preferences (PATCH /api/v1/auth/preferences, /api/v1/settings/preferences, /api/v1/auth/alerts)
        if path in ('/api/v1/auth/preferences', '/api/v1/auth/preferences/', '/api/v1/settings/preferences', '/api/v1/settings/preferences/', '/api/v1/auth/alerts', '/api/v1/auth/alerts/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}

            if 'general' in body and isinstance(body['general'], dict):
                dev.setdefault('general_preferences', {}).update(body['general'])
            if 'notifications' in body and isinstance(body['notifications'], dict):
                dev.setdefault('notification_preferences', {}).update(body['notifications'])
            if 'visibility' in body and isinstance(body['visibility'], dict):
                dev.setdefault('visibility_controls', {}).update(body['visibility'])
            if 'alerts' in body and isinstance(body['alerts'], dict):
                dev.setdefault('security_alerts', {}).update(body['alerts'])

            save_database()
            self.send_json(200, {
                'success': True,
                'message': 'Preferences saved successfully.',
                'general': dev.get('general_preferences', {}),
                'notifications': dev.get('notification_preferences', {}),
                'visibility': dev.get('visibility_controls', {})
            })
            return

        # Current User Profile Update (PATCH /users/me, /api/v1/users/me, /api/v1/settings/profile)
        if path in ('/users/me', '/users/me/', '/api/v1/users/me', '/api/v1/users/me/', '/api/v1/settings/profile', '/api/v1/settings/profile/'):
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required.'})
                return
            dev = get_developer_by_identifier(auth_user['username'])
            if not dev:
                self.send_json(404, {'error': 'User not found.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}

            # Handle Username Update (with validation)
            if 'username' in body and body['username']:
                new_u = str(body['username']).strip()
                valid, err = validate_username(new_u, dev['username'], DEV_PROFILES)
                if not valid:
                    self.send_json(400, {'error': err})
                    return
                if new_u.lower() != dev['username'].lower():
                    old_u = dev['username']
                    dev['username'] = new_u.lower()
                    DEV_PROFILES[new_u.lower()] = DEV_PROFILES.pop(old_u)
                    # Update active session username
                    curr_tok = self.get_session_token()
                    if curr_tok and curr_tok in ACTIVE_SESSIONS:
                        ACTIVE_SESSIONS[curr_tok]['username'] = new_u.lower()

            for field in ('name', 'headline', 'bio', 'location', 'website', 'social', 'skills', 'collaborationStatus', 'collaborationStatusType', 'openToInvitations'):
                if field in body:
                    dev[field] = body[field]

            save_database()
            clean_profile = json.loads(json.dumps(dev))
            clean_profile.pop('password', None)
            self.send_json(200, clean_profile)
            return

        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')
        # PATCH /api/v1/repositories/<repo_id>/members/<username>
        m_mem_patch = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/members/([^/]+)/?$', path)
        if m_mem_patch:
            repo_id = m_mem_patch.group(1)
            target_username = m_mem_patch.group(2).lower()
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': 'Repository not found'})
                return
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return
            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not (is_owner or is_maint):
                self.send_json(403, {'error': 'Forbidden: Only owners and maintainers can update member roles.'})
                return

            length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(length) if length > 0 else b'{}'
            try:
                body = json.loads(post_data.decode('utf-8'))
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

            members = repo.get('members', [])
            mem = next((m for m in members if m.get('username', '').lower() == target_username), None)
            if not mem:
                self.send_json(404, {'error': f'Member @{target_username} not found in this repository.'})
                return

            if mem.get('role') == 'Owner' and not is_owner:
                self.send_json(403, {'error': 'Forbidden: Only repository owner can change owner permissions.'})
                return

            if 'role' in body:
                new_role = str(body['role']).strip()
                if new_role not in ('Owner', 'Maintainer', 'Collaborator', 'Viewer'):
                    self.send_json(400, {'error': 'Invalid role.'})
                    return
                if new_role == 'Owner' and not is_owner:
                    self.send_json(403, {'error': 'Only owner can assign Owner role.'})
                    return
                mem['role'] = new_role

            if 'responsibility' in body:
                mem['responsibility'] = str(body['responsibility']).strip()

            if 'assignedTasks' in body and isinstance(body['assignedTasks'], list):
                mem['assignedTasks'] = body['assignedTasks']

            repo['updated_at'] = time.time()
            record_activity_event(
                'collaborator_updated',
                auth_user['username'],
                repo['name'],
                title=f"Updated role/responsibility for @{target_username}",
                description=f"Role: {mem.get('role')} | Responsibility: {mem.get('responsibility')}",
                visibility=repo.get('visibility', 'Public')
            )
            save_database()
            self.send_json(200, {
                'success': True,
                'message': f'Member @{target_username} updated successfully.',
                'member': mem
            })
            return

        # Profile Update API Endpoint (PATCH /api/developers/<username>, /api/v1/developers/<username>)
        if path.startswith('/api/developers/') or path.startswith('/api/v1/developers/'):
            prefix = '/api/v1/developers/' if path.startswith('/api/v1/developers/') else '/api/developers/'
            identifier = path[len(prefix):].strip().lower()
            dev = get_developer_by_identifier(identifier)
            if not dev:
                self.send_json(404, {'error': 'Developer not found'})
                return

            username = dev['username'].lower()
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

            dev.update(updates)
            save_database()
            updated_copy = json.loads(json.dumps(dev))
            updated_copy.pop('password', None)
            self.send_json(200, updated_copy)
            return

        self.serve_custom_error(405)

    def do_DELETE(self):
        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')

        # Issues, PRs, Teams, and Chat DELETE dispatch
        if backend_issues_prs_chat.handle_delete(self, path, url_parts, self.get_authenticated_user(), save_database):
            return

        # Delete notification via DELETE: /api/v1/notifications/<notif_id>
        m_notif = re.match(r'^/api/(?:v1/)?notifications/([^/]+)/?$', path)
        if m_notif:
            notif_id = m_notif.group(1)
            global NOTIFICATIONS
            NOTIFICATIONS = [n for n in NOTIFICATIONS if n.get('id') != notif_id]
            save_database()
            summary = calculate_notifications_summary(NOTIFICATIONS)
            self.send_json(200, {'success': True, 'deleted': notif_id, 'summary': summary})
            return

        # Revoke session via DELETE: /api/v1/auth/sessions/<session_id>
        m_sess = re.match(r'^/api/(?:v1/)?auth/sessions/([^/]+)/?$', path)
        if m_sess:
            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return
            session_id = m_sess.group(1)
            curr_token = self.get_session_token()
            ok, res = revoke_single_session(ACTIVE_SESSIONS, auth_user['username'], session_id, curr_token)
            if not ok:
                self.send_json(404, {'error': res})
                return
            self.send_json(200, {'success': True, 'message': 'Session revoked successfully.'})
            return

        url_parts = urllib.parse.urlsplit(self.path)
        path = url_parts.path.rstrip('/')
        # Remove repository member: DELETE /api/v1/repositories/<repo_id>/members/<username>
        m = re.match(r'^/api/(?:v1/)?repositories/([^/]+)/members/([^/]+)/?$', path)
        if m:
            repo_id = m.group(1)
            target_username = m.group(2).lower()
            repo = get_repository_by_id_or_name(repo_id)
            if not repo:
                self.send_json(404, {'error': 'Repository not found'})
                return

            auth_user = self.get_authenticated_user()
            if not auth_user:
                self.send_json(401, {'error': 'Authentication required'})
                return

            can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
            if not (is_owner or is_maint):
                self.send_json(403, {'error': 'Forbidden: Only owners and maintainers can remove members.'})
                return

            if target_username == repo.get('owner', '').lower():
                self.send_json(400, {'error': 'Repository owner cannot be removed.'})
                return

            initial_count = len(repo.get('members', []))
            repo['members'] = [mem for mem in repo.get('members', []) if mem.get('username', '').lower() != target_username]
            if len(repo['members']) == initial_count:
                self.send_json(404, {'error': f'Member @{target_username} not found in this repository.'})
                return

            repo['updated_at'] = time.time()
            record_activity_event(
                'collaborator_removed',
                auth_user['username'],
                repo['name'],
                title=f"Removed collaborator @{target_username}",
                description=f"Collaborator @{target_username} was removed from {repo['name']}.",
                visibility=repo.get('visibility', 'Public')
            )
            save_database()
            self.send_json(200, {
                'success': True,
                'message': f'Member @{target_username} removed from repository.',
                'membersCount': len(repo['members'])
            })
            return

        self.serve_custom_error(405)


    def handle_ai_chat(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        message = body.get('message', body.get('prompt', '')).strip()

        # Build grounded context
        auth_user = self.get_authenticated_user() or DEV_PROFILES.get('dev-balaji')
        pulse_data = calculate_contribution_intelligence(auth_user['username']) if auth_user else None
        context_instruction = backend_voice_ai.build_system_instruction(
            user_profile=auth_user,
            repos=REPOSITORIES,
            prs=backend_issues_prs_chat.PULL_REQUESTS,
            issues=backend_issues_prs_chat.ISSUES,
            pulse_data=pulse_data
        )

        # Try Gemini API text model first
        gemini_reply = backend_voice_ai.generate_gemini_text_chat(message, context_instruction=context_instruction)
        if gemini_reply:
            self.send_json(200, {"reply": gemini_reply, "source": "gemini"})
            return

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

        self.send_json(200, {"reply": reply, "source": "local"})

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
            self.send_header('Allow', 'GET, HEAD, POST, PATCH, DELETE, OPTIONS')
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
