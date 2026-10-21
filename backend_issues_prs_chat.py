"""
DevSync Issues, Pull Requests, Teams, and Chat Backend Engine
Provides comprehensive data models, permission enforcement, branch-merging logic,
and full persistence for Issues, Pull Requests, Teams, Direct & Group Conversations,
Communities & Channels, and 24-Hour Developer Status Updates.
"""

import os
import re
import time
import json
import secrets
import hashlib
from datetime import datetime

NOW = time.time()

# --------------------------------------------------------------------------
# 1. Initial Issues Dataset
# --------------------------------------------------------------------------
INITIAL_ISSUES = {
    'issue-104': {
        'id': 'issue-104',
        'number': 104,
        'title': 'Add dark mode support',
        'repository': 'portfolio-site',
        'labels': ['enhancement', 'UI'],
        'author': 'priyas',
        'authorName': 'Priya S',
        'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 2,
        'status': 'Open',
        'created_at': NOW - 2 * 3600,
        'updated_at': NOW - 2 * 3600,
        'updated': '2 hours ago',
        'description': 'The user settings need an explicit theme selector (Light / Dark / System default) with custom CSS property overrides.',
        'comments': [
            {
                'id': 'comm-104-1',
                'author': 'arjun',
                'authorName': 'Arjun',
                'authorAvatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80',
                'text': 'I have drafted the CSS variables in tokens.css. Ready to test when we wire up the preferences toggle.',
                'created_at': NOW - 3600,
                'time': '1 hour ago'
            },
            {
                'id': 'comm-104-2',
                'author': 'priyas',
                'authorName': 'Priya S',
                'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
                'text': 'Great! Let us ensure high contrast ratios for accessibility compliance.',
                'created_at': NOW - 1800,
                'time': '30 minutes ago'
            }
        ]
    },
    'issue-102': {
        'id': 'issue-102',
        'number': 102,
        'title': 'Fix file upload size limit',
        'repository': 'campus-connect',
        'labels': ['bug', 'backend'],
        'author': 'arjun',
        'authorName': 'Arjun',
        'authorAvatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 1,
        'status': 'Open',
        'created_at': NOW - 5 * 3600,
        'updated_at': NOW - 5 * 3600,
        'updated': '5 hours ago',
        'description': 'Files larger than 10MB trigger an unhandled 413 error in upload endpoint. We should increase max body size.',
        'comments': [
            {
                'id': 'comm-102-1',
                'author': 'naveen3438',
                'authorName': 'Naveen Kumar D',
                'authorAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
                'text': 'Will increase Nginx and Django client max body limits to 50MB and add streaming chunks.',
                'created_at': NOW - 2 * 3600,
                'time': '2 hours ago'
            }
        ]
    },
    'issue-99': {
        'id': 'issue-99',
        'number': 99,
        'title': 'Add analytics dashboard',
        'repository': 'devsync-core',
        'labels': ['feature', 'analytics'],
        'author': 'sneha',
        'authorName': 'Sneha',
        'authorAvatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 1,
        'status': 'Open',
        'created_at': NOW - 86400,
        'updated_at': NOW - 86400,
        'updated': '1 day ago',
        'description': 'Provide commit volume trends, repository health metrics, and team velocity heatmaps.',
        'comments': [
            {
                'id': 'comm-99-1',
                'author': 'balajikumar',
                'authorName': 'Balaji',
                'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
                'text': 'Pulse aggregation engine endpoints are ready for integration.',
                'created_at': NOW - 40000,
                'time': '11 hours ago'
            }
        ]
    },
    'issue-94': {
        'id': 'issue-94',
        'number': 94,
        'title': 'Improve mobile layout',
        'repository': 'chaturya-club',
        'labels': ['UI', 'responsive'],
        'author': 'balajikumar',
        'authorName': 'Balaji',
        'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 0,
        'status': 'Open',
        'created_at': NOW - 2 * 86400,
        'updated_at': NOW - 2 * 86400,
        'updated': '2 days ago',
        'description': 'Ensure cards, tables, and buttons scale gracefully on small mobile screens without horizontal scroll.',
        'comments': []
    },
    'issue-88': {
        'id': 'issue-88',
        'number': 88,
        'title': 'Database backup script',
        'repository': 'heavy-machinery',
        'labels': ['infrastructure', 'database'],
        'author': 'karthik',
        'authorName': 'Karthik',
        'authorAvatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 1,
        'status': 'Open',
        'created_at': NOW - 3 * 86400,
        'updated_at': NOW - 3 * 86400,
        'updated': '3 days ago',
        'description': 'Automate daily pg_dump backups to S3-compatible cold storage bucket with encryption.',
        'comments': [
            {
                'id': 'comm-88-1',
                'author': 'tarapatel',
                'authorName': 'Tara Patel',
                'authorAvatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=64&q=80',
                'text': 'Cron automation script tested on staging. Retains 14 daily snapshots.',
                'created_at': NOW - 2 * 86400,
                'time': '2 days ago'
            }
        ]
    },
    'issue-82': {
        'id': 'issue-82',
        'number': 82,
        'title': 'Implement PBKDF2 password hashing',
        'repository': 'devsync-core',
        'labels': ['security', 'backend'],
        'author': 'balajikumar',
        'authorName': 'Balaji',
        'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 2,
        'status': 'Closed',
        'created_at': NOW - 7 * 86400,
        'updated_at': NOW - 4 * 86400,
        'updated': '4 days ago',
        'closed_at': NOW - 4 * 86400,
        'closed_by': 'balajikumar',
        'description': 'Upgrade user credentials storage from legacy formats to Django PBKDF2 SHA-256 with 1,500,000 iterations.',
        'comments': [
            {
                'id': 'comm-82-1',
                'author': 'naveen3438',
                'authorName': 'Naveen Kumar D',
                'authorAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
                'text': 'Hasher configured and tested. Passwords automatically upgrade upon successful login.',
                'created_at': NOW - 4 * 86400,
                'time': '4 days ago'
            }
        ]
    },
    'issue-76': {
        'id': 'issue-76',
        'number': 76,
        'title': 'Refactor top navigation search bar',
        'repository': 'devsync-core',
        'labels': ['UI', 'enhancement'],
        'author': 'priyas',
        'authorName': 'Priya S',
        'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        'commentsCount': 1,
        'status': 'Closed',
        'created_at': NOW - 9 * 86400,
        'updated_at': NOW - 6 * 86400,
        'updated': '6 days ago',
        'closed_at': NOW - 6 * 86400,
        'closed_by': 'priyas',
        'description': 'Standardize search bar styles and keyboard shortcuts (Cmd/Ctrl + K) across all workspace layouts.',
        'comments': []
    }
}

# --------------------------------------------------------------------------
# 2. Initial Pull Requests Dataset
# --------------------------------------------------------------------------
INITIAL_PULL_REQUESTS = {
    'pr-42': {
        'id': 'pr-42',
        'number': 42,
        'title': 'Add user authentication with Google OAuth',
        'author': 'priyas',
        'authorName': 'Priya S',
        'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        'repository': 'campus-connect',
        'labels': ['enhancement', 'auth'],
        'reviewers': [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80'
        ],
        'commentsCount': 4,
        'status': 'Open',
        'statusClass': 'badge-status-open',
        'created_at': NOW - 2 * 3600,
        'updated_at': NOW - 2 * 3600,
        'updated': '2 hours ago',
        'sourceBranch': 'feat/google-oauth',
        'targetBranch': 'main',
        'description': 'Implements Google OAuth 2.0 social login, token verification, and session setup.',
        'commitsCount': 3,
        'changedFilesCount': 1,
        'commits': [
            { 'hash': 'e8a4bc1', 'message': 'Add Google OAuth token exchange handler', 'author': 'Priya S', 'time': '2 hours ago' },
            { 'hash': '7c2f9d0', 'message': 'Handle CSRF exemptions for OAuth callback', 'author': 'Priya S', 'time': '2 hours ago' },
            { 'hash': '3b1a8f4', 'message': 'Store verified Google profile picture in session', 'author': 'Priya S', 'time': '1 hour ago' }
        ],
        'changedFiles': [
            {
                'path': 'apps/auth/views.py',
                'additions': 18,
                'deletions': 2,
                'diff': '+ def authenticate_user(request, provider="google"):\n+     token = request.data.get("id_token")\n+     verified_payload = verify_google_oauth_token(token)\n+     user, created = User.objects.get_or_create(email=verified_payload["email"])\n       return Response({"status": "authenticated", "user_id": user.id})'
            }
        ],
        'reviews': [
            { 'author': 'naveen3438', 'action': 'approve', 'comment': 'Looks solid! Verified audience token matching.', 'created_at': NOW - 3600 }
        ]
    },
    'pr-41': {
        'id': 'pr-41',
        'number': 41,
        'title': 'Fix navbar responsive issue on mobile',
        'author': 'arjun',
        'authorName': 'Arjun',
        'authorAvatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80',
        'repository': 'portfolio-site',
        'labels': ['bug', 'frontend'],
        'reviewers': [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'
        ],
        'commentsCount': 2,
        'status': 'Open',
        'statusClass': 'badge-status-open',
        'created_at': NOW - 5 * 3600,
        'updated_at': NOW - 5 * 3600,
        'updated': '5 hours ago',
        'sourceBranch': 'fix/mobile-navbar',
        'targetBranch': 'main',
        'description': 'Ensures menu links collapse into the drawer on mobile viewport sizes.',
        'commitsCount': 1,
        'changedFilesCount': 1,
        'commits': [
            { 'hash': '4d1f2e9', 'message': 'Fix mobile navigation drawer toggle', 'author': 'Arjun', 'time': '5 hours ago' }
        ],
        'changedFiles': [
            { 'path': 'src/css/navbar.css', 'additions': 8, 'deletions': 4, 'diff': '+ @media (max-width: 768px) { .nav-menu { display: none; } }' }
        ],
        'reviews': []
    },
    'pr-39': {
        'id': 'pr-39',
        'number': 39,
        'title': 'Improve database schema and add indexes',
        'author': 'karthik',
        'authorName': 'Karthik',
        'authorAvatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
        'repository': 'devsync-core',
        'labels': ['database', 'performance'],
        'reviewers': [
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'
        ],
        'commentsCount': 6,
        'status': 'Open',
        'statusClass': 'badge-status-open',
        'created_at': NOW - 86400,
        'updated_at': NOW - 86400,
        'updated': '1 day ago',
        'sourceBranch': 'develop',
        'targetBranch': 'main',
        'description': 'Adds composite indexes on foreign keys to optimize query execution down from 240ms to 18ms.',
        'commitsCount': 2,
        'changedFilesCount': 2,
        'commits': [
            { 'hash': '9f8e7d6', 'message': 'Add composite btree index on repo_id and created_at', 'author': 'Karthik', 'time': '1 day ago' },
            { 'hash': '1a2b3c4', 'message': 'Benchmark query plans with EXPLAIN ANALYZE', 'author': 'Karthik', 'time': '1 day ago' }
        ],
        'changedFiles': [
            { 'path': 'apps/core/models.py', 'additions': 14, 'deletions': 1, 'diff': '+ class Meta:\n+     indexes = [models.Index(fields=["repository", "created_at"])]' }
        ],
        'reviews': [
            { 'author': 'balajikumar', 'action': 'approve', 'comment': 'Performance improvement verified on staging.', 'created_at': NOW - 30000 }
        ]
    },
    'pr-38': {
        'id': 'pr-38',
        'number': 38,
        'title': 'Add image upload for gallery',
        'author': 'sneha',
        'authorName': 'Sneha',
        'authorAvatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80',
        'repository': 'chaturya-club',
        'labels': ['feature', 'media'],
        'reviewers': [
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80'
        ],
        'commentsCount': 3,
        'status': 'Open',
        'statusClass': 'badge-status-open',
        'created_at': NOW - 2 * 86400,
        'updated_at': NOW - 2 * 86400,
        'updated': '2 days ago',
        'sourceBranch': 'feat/gallery-upload',
        'targetBranch': 'main',
        'description': 'Enables multipart image uploads with automatic thumbnail generation.',
        'commitsCount': 1,
        'changedFilesCount': 1,
        'commits': [
            { 'hash': '3c2b1a0', 'message': 'Add Pillow thumbnail resizer pipeline', 'author': 'Sneha', 'time': '2 days ago' }
        ],
        'changedFiles': [
            { 'path': 'apps/gallery/views.py', 'additions': 25, 'deletions': 3, 'diff': '+ def upload_thumbnail(image):\n+     im = Image.open(image)\n+     im.thumbnail((300, 300))' }
        ],
        'reviews': []
    },
    'pr-37': {
        'id': 'pr-37',
        'number': 37,
        'title': 'Update documentation for local deployment',
        'author': 'ananyaroy',
        'authorName': 'Ananya Roy',
        'authorAvatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=64&q=80',
        'repository': 'devsync-core',
        'labels': ['docs'],
        'reviewers': ['balajikumar'],
        'commentsCount': 1,
        'status': 'Closed',
        'statusClass': 'badge-status-closed',
        'created_at': NOW - 4 * 86400,
        'updated_at': NOW - 3 * 86400,
        'updated': '3 days ago',
        'closed_at': NOW - 3 * 86400,
        'closed_by': 'balajikumar',
        'sourceBranch': 'develop',
        'targetBranch': 'main',
        'description': 'Added README deployment steps for Ubuntu 24.04 and Docker Compose.',
        'commitsCount': 1,
        'changedFilesCount': 1,
        'commits': [],
        'changedFiles': [],
        'reviews': []
    },
    'pr-36': {
        'id': 'pr-36',
        'number': 36,
        'title': 'Refactor API endpoints and serializers',
        'author': 'balajikumar',
        'authorName': 'Balaji',
        'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
        'repository': 'devsync-core',
        'labels': ['refactor', 'backend'],
        'reviewers': [
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80'
        ],
        'commentsCount': 5,
        'status': 'Merged',
        'statusClass': 'badge-status-merged',
        'created_at': NOW - 5 * 86400,
        'updated_at': NOW - 3 * 86400,
        'updated': '3 days ago',
        'merged_at': NOW - 3 * 86400,
        'merged_by': 'balajikumar',
        'sourceBranch': 'develop',
        'targetBranch': 'main',
        'description': 'Standardized response serializations and paginator interfaces across API controllers.',
        'commitsCount': 2,
        'changedFilesCount': 1,
        'commits': [
            { 'hash': '62bb4ac', 'message': 'Add standardized pagination envelope', 'author': 'Balaji', 'time': '3 days ago' }
        ],
        'changedFiles': [
            { 'path': 'apps/api/views.py', 'additions': 32, 'deletions': 10, 'diff': '+ class StandardPagination(PageNumberPagination):\n+     page_size = 10' }
        ],
        'reviews': [
            { 'author': 'karthik', 'action': 'approve', 'comment': 'Clean refactoring.', 'created_at': NOW - 3 * 86400 }
        ]
    }
}

# --------------------------------------------------------------------------
# 3. Initial Teams & Collaborators Dataset
# --------------------------------------------------------------------------
INITIAL_TEAMS = {
    'devsync-core': {
        'id': 'team-devsync',
        'name': 'devsync-core',
        'title': 'DevSync Core Platform',
        'description': 'Core backend microservices, async worker pipelines, and developer collaboration services.',
        'ownerUsername': 'balajikumar',
        'ownerName': 'Balaji',
        'language': 'Python',
        'visibility': 'Private',
        'memberUsernames': ['balajikumar', 'naveen3438', 'priyas', 'ananyaroy', 'vikramrao']
    },
    'campus-connect': {
        'id': 'team-campus',
        'name': 'campus-connect',
        'title': 'Campus Connect',
        'description': 'Student community engagement portal and academic collaboration suite.',
        'ownerUsername': 'naveen3438',
        'ownerName': 'Naveen Kumar D',
        'language': 'Django',
        'visibility': 'Public',
        'memberUsernames': ['naveen3438', 'priyas', 'arjun', 'sneha']
    },
    'ai-tools': {
        'id': 'team-ai',
        'name': 'ai-tools',
        'title': 'AI Coding Assistant',
        'description': 'Autonomous multi-file refactoring, diff generation, and agentic workflows.',
        'ownerUsername': 'balajikumar',
        'ownerName': 'Balaji',
        'language': 'TypeScript',
        'visibility': 'Private',
        'memberUsernames': ['balajikumar', 'naveen3438', 'vikramrao']
    },
    'chaturya-club': {
        'id': 'team-chaturya',
        'name': 'chaturya-club',
        'title': 'Chaturya Tech Club',
        'description': 'Event registration portals, club activities, and student project showcases.',
        'ownerUsername': 'naveen3438',
        'ownerName': 'Naveen Kumar D',
        'language': 'Flask',
        'visibility': 'Public',
        'memberUsernames': ['naveen3438', 'arjun', 'sneha']
    },
    'heavy-machinery': {
        'id': 'team-heavy',
        'name': 'heavy-machinery',
        'title': 'Heavy Machinery DevOps',
        'description': 'Automated deployment pipelines, telemetry monitors, and cloud infrastructure.',
        'ownerUsername': 'balajikumar',
        'ownerName': 'Balaji',
        'language': 'Python',
        'visibility': 'Private',
        'memberUsernames': ['balajikumar', 'karthik', 'tarapatel']
    }
}

INITIAL_TEAM_MEMBERS = [
    {
        'id': 'member-balaji',
        'name': 'Balaji',
        'username': 'balajikumar',
        'email': 'balaji@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Owner',
        'contributionsCount': 245,
        'isOnline': True,
        'availability': 'Available',
        'joined': 'Jan 2024',
        'assignedProjects': ['DevSync Core Platform', 'AI Coding Assistant', 'Heavy Machinery DevOps'],
        'projectRoles': {
            'devsync-core': 'Owner',
            'ai-tools': 'Owner',
            'heavy-machinery': 'Owner'
        }
    },
    {
        'id': 'member-naveen',
        'name': 'Naveen Kumar D',
        'username': 'naveen3438',
        'email': 'naveen@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Lead Maintainer',
        'contributionsCount': 248,
        'isOnline': True,
        'availability': 'Available',
        'joined': 'Jan 2024',
        'assignedProjects': ['DevSync Core Platform', 'Campus Connect', 'AI Coding Assistant', 'Chaturya Tech Club'],
        'projectRoles': {
            'devsync-core': 'Maintainer',
            'campus-connect': 'Owner',
            'ai-tools': 'Maintainer',
            'chaturya-club': 'Owner'
        }
    },
    {
        'id': 'member-priya',
        'name': 'Priya S',
        'username': 'priyas',
        'email': 'priya@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Collaborator',
        'contributionsCount': 132,
        'isOnline': True,
        'availability': 'Busy',
        'joined': 'Feb 2024',
        'assignedProjects': ['DevSync Core Platform', 'Campus Connect'],
        'projectRoles': {
            'devsync-core': 'Collaborator',
            'campus-connect': 'Collaborator'
        }
    },
    {
        'id': 'member-arjun',
        'name': 'Arjun',
        'username': 'arjun',
        'email': 'arjun@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Collaborator',
        'contributionsCount': 98,
        'isOnline': False,
        'availability': 'In Review',
        'joined': 'Mar 2024',
        'assignedProjects': ['Campus Connect', 'Chaturya Tech Club'],
        'projectRoles': {
            'campus-connect': 'Collaborator',
            'chaturya-club': 'Collaborator'
        }
    },
    {
        'id': 'member-sneha',
        'name': 'Sneha',
        'username': 'sneha',
        'email': 'sneha@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Collaborator',
        'contributionsCount': 76,
        'isOnline': True,
        'availability': 'Available',
        'joined': 'Mar 2024',
        'assignedProjects': ['Campus Connect', 'Chaturya Tech Club'],
        'projectRoles': {
            'campus-connect': 'Collaborator',
            'chaturya-club': 'Collaborator'
        }
    },
    {
        'id': 'member-karthik',
        'name': 'Karthik',
        'username': 'karthik',
        'email': 'karthik@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Collaborator',
        'contributionsCount': 114,
        'isOnline': True,
        'availability': 'Available',
        'joined': 'Apr 2024',
        'assignedProjects': ['Heavy Machinery DevOps'],
        'projectRoles': {
            'heavy-machinery': 'Collaborator'
        }
    },
    {
        'id': 'member-tarapatel',
        'name': 'Tara Patel',
        'username': 'tarapatel',
        'email': 'tara@devsync.dev',
        'avatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80',
        'globalRole': 'Collaborator',
        'contributionsCount': 89,
        'isOnline': False,
        'availability': 'Available',
        'joined': 'May 2024',
        'assignedProjects': ['Heavy Machinery DevOps'],
        'projectRoles': {
            'heavy-machinery': 'Collaborator'
        }
    }
]

# --------------------------------------------------------------------------
# 4. Initial DevSync Chat & Communities Dataset
# --------------------------------------------------------------------------
INITIAL_CONVERSATIONS = {
    'conv-direct-balaji': {
        'id': 'conv-direct-balaji',
        'type': 'direct',
        'title': 'Balaji',
        'avatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        'members': ['naveen3438', 'balajikumar'],
        'admins': ['balajikumar'],
        'isOnline': True,
        'unreadCount': 0,
        'updated_at': NOW - 1200,
        'lastMessage': 'Awesome work Priya! I will review PR #42 shortly. The architecture looks clean.',
        'lastMessageTime': '10:28 AM'
    },
    'conv-direct-priya': {
        'id': 'conv-direct-priya',
        'type': 'direct',
        'title': 'Priya S',
        'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
        'members': ['naveen3438', 'priyas'],
        'admins': ['priyas'],
        'isOnline': True,
        'unreadCount': 1,
        'updated_at': NOW - 2400,
        'lastMessage': 'Good morning everyone! Just pushed the initial commit for OAuth integration.',
        'lastMessageTime': '10:24 AM'
    },
    'conv-direct-karthik': {
        'id': 'conv-direct-karthik',
        'type': 'direct',
        'title': 'Karthik',
        'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
        'members': ['naveen3438', 'karthik'],
        'admins': ['karthik'],
        'isOnline': True,
        'unreadCount': 0,
        'updated_at': NOW - 7200,
        'lastMessage': 'Database indexes are staged in #39. Query times dropped from 240ms to 18ms.',
        'lastMessageTime': '11:15 AM'
    },
    'conv-direct-balaji-priya': {
        'id': 'conv-direct-balaji-priya',
        'type': 'direct',
        'title': 'Priya S',
        'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
        'members': ['balajikumar', 'priyas'],
        'admins': ['balajikumar'],
        'isOnline': True,
        'unreadCount': 0,
        'updated_at': NOW - 2000,
        'lastMessage': 'Can you check the migration plan for PostgreSQL 16?',
        'lastMessageTime': '10:35 AM'
    },
    'conv-group-core': {
        'id': 'conv-group-core',
        'type': 'group',
        'title': 'DevSync Core Squad',
        'avatar': '',
        'members': ['naveen3438', 'balajikumar', 'priyas', 'karthik', 'ananyaroy'],
        'admins': ['balajikumar', 'naveen3438'],
        'isOnline': False,
        'unreadCount': 0,
        'updated_at': NOW - 1800,
        'description': 'Official backend microservices and core platform engineering squad.',
        'lastMessage': 'Sprint planning scheduled for tomorrow at 10 AM IST.',
        'lastMessageTime': '12:05 PM'
    }
}

INITIAL_MESSAGES = {
    'conv-direct-balaji': [
        {
            'id': 'msg-b1',
            'conversation_id': 'conv-direct-balaji',
            'sender': 'balajikumar',
            'senderName': 'Balaji',
            'senderAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
            'text': 'Hey Naveen! Have you checked the latest Project Pulse aggregation commits?',
            'timestamp': NOW - 3600,
            'time': '10:15 AM',
            'status': 'read',
            'reply_to': None,
            'reactions': {'👍': ['naveen3438']}
        },
        {
            'id': 'msg-b2',
            'conversation_id': 'conv-direct-balaji',
            'sender': 'naveen3438',
            'senderName': 'Naveen Kumar D',
            'senderAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
            'text': 'Yes, verified them. The 24h and 7d bucketing looks spotless. Moving to the PR review engine next.',
            'timestamp': NOW - 2400,
            'time': '10:20 AM',
            'status': 'read',
            'reply_to': 'msg-b1',
            'reactions': {'🔥': ['balajikumar']}
        },
        {
            'id': 'msg-b3',
            'conversation_id': 'conv-direct-balaji',
            'sender': 'balajikumar',
            'senderName': 'Balaji',
            'senderAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
            'text': 'Awesome work Priya! I will review PR #42 shortly. The architecture looks clean.',
            'timestamp': NOW - 1200,
            'time': '10:28 AM',
            'status': 'read',
            'reply_to': None,
            'reactions': {}
        }
    ],
    'conv-direct-priya': [
        {
            'id': 'msg-p1',
            'conversation_id': 'conv-direct-priya',
            'sender': 'priyas',
            'senderName': 'Priya S',
            'senderAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
            'text': 'Good morning everyone! Just pushed the initial commit for OAuth integration.',
            'timestamp': NOW - 2400,
            'time': '10:24 AM',
            'status': 'delivered',
            'reply_to': None,
            'reactions': {'🚀': ['naveen3438']}
        }
    ],
    'conv-direct-karthik': [
        {
            'id': 'msg-k1',
            'conversation_id': 'conv-direct-karthik',
            'sender': 'karthik',
            'senderName': 'Karthik',
            'senderAvatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
            'text': 'Database indexes are staged in #39. Query times dropped from 240ms to 18ms.',
            'timestamp': NOW - 7200,
            'time': '11:15 AM',
            'status': 'read',
            'reply_to': None,
            'reactions': {'⚡': ['naveen3438', 'balajikumar']}
        }
    ],
    'conv-direct-balaji-priya': [
        {
            'id': 'msg-bp1',
            'conversation_id': 'conv-direct-balaji-priya',
            'sender': 'priyas',
            'senderName': 'Priya S',
            'senderAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
            'text': 'Can you check the migration plan for PostgreSQL 16?',
            'timestamp': NOW - 2000,
            'time': '10:35 AM',
            'status': 'read',
            'reply_to': None,
            'reactions': {'👍': ['balajikumar']}
        }
    ],
    'conv-group-core': [
        {
            'id': 'msg-g1',
            'conversation_id': 'conv-group-core',
            'sender': 'balajikumar',
            'senderName': 'Balaji',
            'senderAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
            'text': 'Team, please review open PRs #42 and #39 before the staging merge freeze today.',
            'timestamp': NOW - 3600,
            'time': '11:45 AM',
            'status': 'read',
            'reply_to': None,
            'reactions': {'👍': ['priyas', 'naveen3438']}
        },
        {
            'id': 'msg-g2',
            'conversation_id': 'conv-group-core',
            'sender': 'naveen3438',
            'senderName': 'Naveen Kumar D',
            'senderAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
            'text': 'Sprint planning scheduled for tomorrow at 10 AM IST.',
            'timestamp': NOW - 1800,
            'time': '12:05 PM',
            'status': 'read',
            'reply_to': None,
            'reactions': {}
        }
    ]
}

INITIAL_COMMUNITIES = {
    'comm-devsync': {
        'id': 'comm-devsync',
        'name': 'DevSync Core',
        'description': 'Engineering community for DevSync open source platform and microservices.',
        'project': 'devsync-core',
        'channels': [
            {
                'id': 'ch-general',
                'name': 'general',
                'desc': 'General developer discussions and team chat',
                'unread': False,
                'pinnedAnnouncement': 'DevSync 2.0 release candidate is in staging! Test the new Issues, PRs and Chat features.'
            },
            {
                'id': 'ch-frontend',
                'name': 'frontend',
                'desc': 'UI architecture, HTML5, Tailwind CSS tokens, and JavaScript modules',
                'unread': True,
                'pinnedAnnouncement': None
            },
            {
                'id': 'ch-django-backend',
                'name': 'django-backend',
                'desc': 'Django APIs, PostgreSQL modeling, async worker tasks, and caching',
                'unread': False,
                'pinnedAnnouncement': None
            },
            {
                'id': 'ch-showcase',
                'name': 'showcase',
                'desc': 'Show off your completed repositories, demo branches, and pull requests',
                'unread': False,
                'pinnedAnnouncement': None
            },
            {
                'id': 'ch-announcements',
                'name': 'announcements',
                'desc': 'Platform announcements, release notes, and community updates',
                'unread': False,
                'pinnedAnnouncement': 'Community notice: Please remember to keep code discussions friendly and verify branch targets.'
            }
        ]
    },
    'comm-campus': {
        'id': 'comm-campus',
        'name': 'Campus Connect',
        'description': 'Student developers community and academic project collaboration.',
        'project': 'campus-connect',
        'channels': [
            {
                'id': 'ch-campus-gen',
                'name': 'general',
                'desc': 'Campus community discussions and project ideas',
                'unread': False,
                'pinnedAnnouncement': None
            },
            {
                'id': 'ch-campus-events',
                'name': 'events',
                'desc': 'Hackathons, workshops, and student project demos',
                'unread': False,
                'pinnedAnnouncement': None
            }
        ]
    }
}

INITIAL_CHANNEL_MESSAGES = {
    'ch-general': [
        {
            'id': 'cmsg-1',
            'channelId': 'ch-general',
            'author': 'Priya S',
            'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
            'time': '10:24 AM',
            'text': 'Good morning everyone! Just pushed the initial commit for OAuth integration.',
            'reactions': {'👋': ['balajikumar', 'naveen3438']}
        },
        {
            'id': 'cmsg-2',
            'channelId': 'ch-general',
            'author': 'Balaji',
            'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
            'time': '10:28 AM',
            'text': 'Awesome work Priya! I will review PR #42 shortly. The architecture looks clean.',
            'reactions': {'🚀': ['priyas']}
        },
        {
            'id': 'cmsg-3',
            'channelId': 'ch-general',
            'author': 'Karthik',
            'authorAvatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
            'time': '11:15 AM',
            'text': 'Database indexes are staged in #39. Query times dropped from 240ms to 18ms.',
            'reactions': {'🔥': ['balajikumar']}
        }
    ],
    'ch-frontend': [
        {
            'id': 'cmsg-f1',
            'channelId': 'ch-frontend',
            'author': 'Priya S',
            'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
            'time': 'Yesterday',
            'text': 'New tokens for mint accents and neutral surfaces have landed in tokens.css.',
            'reactions': {}
        }
    ],
    'ch-django-backend': [
        {
            'id': 'cmsg-d1',
            'channelId': 'ch-django-backend',
            'author': 'Naveen Kumar D',
            'authorAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
            'time': '2 days ago',
            'text': 'All API serializers now inherit from a standardized pagination response wrapper.',
            'reactions': {'👍': ['balajikumar']}
        }
    ]
}

INITIAL_STATUS_UPDATES = [
    {
        'id': 'stat-naveen',
        'author': 'naveen3438',
        'authorName': 'Naveen Kumar D',
        'authorAvatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
        'text': 'Refactoring PR review engine & WhatsApp-style discussions',
        'media': None,
        'audience': 'everyone',
        'created_at': NOW - 3600,
        'expires_at': NOW + 23 * 3600
    },
    {
        'id': 'stat-priya',
        'author': 'priyas',
        'authorName': 'Priya S',
        'authorAvatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        'text': 'Polishing DevSync mint design tokens and typography',
        'media': None,
        'audience': 'everyone',
        'created_at': NOW - 7200,
        'expires_at': NOW + 22 * 3600
    },
    {
        'id': 'stat-balaji',
        'author': 'balajikumar',
        'authorName': 'Balaji',
        'authorAvatar': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80',
        'text': 'PostgreSQL connection pooling benchmarks look amazing',
        'media': None,
        'audience': 'everyone',
        'created_at': NOW - 10800,
        'expires_at': NOW + 21 * 3600
    }
]

# --------------------------------------------------------------------------
# Active In-Memory Store
# --------------------------------------------------------------------------
ISSUES = dict(INITIAL_ISSUES)
PULL_REQUESTS = dict(INITIAL_PULL_REQUESTS)
TEAMS = dict(INITIAL_TEAMS)
TEAM_MEMBERS = list(INITIAL_TEAM_MEMBERS)
CONVERSATIONS = dict(INITIAL_CONVERSATIONS)
MESSAGES = dict(INITIAL_MESSAGES)
COMMUNITIES = dict(INITIAL_COMMUNITIES)
CHANNEL_MESSAGES = dict(INITIAL_CHANNEL_MESSAGES)
STATUS_UPDATES = list(INITIAL_STATUS_UPDATES)

# --------------------------------------------------------------------------
# Database Persistence Integration
# --------------------------------------------------------------------------
def load_state_from_data(data):
    """Populate in-memory structures from loaded database dictionary."""
    global ISSUES, PULL_REQUESTS, TEAMS, TEAM_MEMBERS, CONVERSATIONS, MESSAGES, COMMUNITIES, CHANNEL_MESSAGES, STATUS_UPDATES
    if 'issues' in data:
        ISSUES = data['issues']
    if 'pull_requests' in data:
        PULL_REQUESTS = data['pull_requests']
    if 'teams' in data:
        TEAMS = data['teams']
    if 'team_members' in data:
        TEAM_MEMBERS = data['team_members']
    if 'conversations' in data:
        CONVERSATIONS = data['conversations']
    if 'messages' in data:
        MESSAGES = data['messages']
    if 'communities' in data:
        COMMUNITIES = data['communities']
    if 'channel_messages' in data:
        CHANNEL_MESSAGES = data['channel_messages']
    if 'status_updates' in data:
        STATUS_UPDATES = data['status_updates']

def export_state_to_data(data):
    """Serialize current in-memory structures into database dictionary."""
    data['issues'] = ISSUES
    data['pull_requests'] = PULL_REQUESTS
    data['teams'] = TEAMS
    data['team_members'] = TEAM_MEMBERS
    data['conversations'] = CONVERSATIONS
    data['messages'] = MESSAGES
    data['communities'] = COMMUNITIES
    data['channel_messages'] = CHANNEL_MESSAGES
    data['status_updates'] = STATUS_UPDATES

# --------------------------------------------------------------------------
# Issues Business Logic
# --------------------------------------------------------------------------
def list_issues(status=None, repository=None, label=None, author=None, search=None, sort='newest'):
    """Return filtered and sorted list of issues."""
    results = list(ISSUES.values())

    if status and status.lower() != 'all':
        st = status.lower()
        results = [i for i in results if i.get('status', '').lower() == st]

    if repository and repository.lower() not in ('all', 'all repositories'):
        repo_filter = repository.lower()
        results = [i for i in results if i.get('repository', '').lower() == repo_filter]

    if label and label.lower() not in ('all', 'all labels'):
        lbl_filter = label.lower()
        results = [i for i in results if any(lbl_filter == str(l).lower() for l in i.get('labels', []))]

    if author and author.lower() not in ('all', 'all authors'):
        auth_filter = author.lower()
        results = [i for i in results if i.get('author', '').lower() == auth_filter or i.get('authorName', '').lower() == auth_filter]

    if search:
        s = search.strip().lower()
        results = [i for i in results if s in i.get('title', '').lower() or s in i.get('description', '').lower()]

    if sort == 'recently-updated':
        results.sort(key=lambda x: x.get('updated_at', 0), reverse=True)
    elif sort == 'comments':
        results.sort(key=lambda x: x.get('commentsCount', 0), reverse=True)
    else:  # 'newest' default
        results.sort(key=lambda x: x.get('number', 0), reverse=True)

    return results

def get_issue(issue_id_or_number):
    """Resolve issue by string ID or numeric number."""
    key = str(issue_id_or_number).strip()
    if key in ISSUES:
        return ISSUES[key]
    for issue in ISSUES.values():
        if str(issue.get('number')) == key or str(issue.get('id')) == key:
            return issue
    return None

def create_issue(data, actor_username, dev_profiles=None):
    """Create a new issue with validation."""
    title = str(data.get('title', '')).strip()
    if not title:
        return None, "Issue title is required."
    repository = str(data.get('repository', 'devsync-core')).strip()

    description = str(data.get('description', '')).strip()
    labels = data.get('labels', ['enhancement'])
    if isinstance(labels, str):
        labels = [l.strip() for l in labels.split(',') if l.strip()]

    max_num = max([i.get('number', 0) for i in ISSUES.values()] + [100])
    new_number = max_num + 1
    new_id = f"issue-{new_number}"

    author_name = actor_username
    author_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and actor_username in dev_profiles:
        p = dev_profiles[actor_username]
        author_name = p.get('name', actor_username)
        author_avatar = p.get('avatar', author_avatar)

    new_issue = {
        'id': new_id,
        'number': new_number,
        'title': title,
        'repository': repository,
        'labels': labels,
        'author': actor_username,
        'authorName': author_name,
        'authorAvatar': author_avatar,
        'commentsCount': 0,
        'status': 'Open',
        'created_at': time.time(),
        'updated_at': time.time(),
        'updated': 'Just now',
        'description': description,
        'comments': []
    }
    ISSUES[new_id] = new_issue
    return new_issue, None

def add_issue_comment(issue_id_or_number, text, actor_username, dev_profiles=None):
    """Add comment to issue."""
    issue = get_issue(issue_id_or_number)
    if not issue:
        return None, "Issue not found."
    t = str(text).strip()
    if not t:
        return None, "Comment text is required."

    author_name = actor_username
    author_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and actor_username in dev_profiles:
        p = dev_profiles[actor_username]
        author_name = p.get('name', actor_username)
        author_avatar = p.get('avatar', author_avatar)

    comment = {
        'id': f"comm-{issue['number']}-{len(issue.get('comments', [])) + 1}",
        'author': actor_username,
        'authorName': author_name,
        'authorAvatar': author_avatar,
        'text': t,
        'created_at': time.time(),
        'time': 'Just now'
    }
    issue['comments'].append(comment)
    issue['commentsCount'] = len(issue['comments'])
    issue['updated_at'] = time.time()
    issue['updated'] = 'Just now'
    return comment, None

def set_issue_status(issue_id_or_number, new_status, actor_username):
    """Close or reopen an issue."""
    issue = get_issue(issue_id_or_number)
    if not issue:
        return None, "Issue not found."
    st = str(new_status).strip().capitalize()
    if st not in ('Open', 'Closed'):
        return None, "Invalid status. Must be 'Open' or 'Closed'."

    issue['status'] = st
    issue['updated_at'] = time.time()
    issue['updated'] = 'Just now'
    if st == 'Closed':
        issue['closed_at'] = time.time()
        issue['closed_by'] = actor_username
    else:
        issue.pop('closed_at', None)
        issue.pop('closed_by', None)
    return issue, None

# --------------------------------------------------------------------------
# Pull Requests Business Logic & Real Merge Operations
# --------------------------------------------------------------------------
def list_pull_requests(status=None, repository=None, author=None, search=None, sort='newest'):
    """Return filtered and sorted list of pull requests."""
    results = list(PULL_REQUESTS.values())

    if status and status.lower() != 'all':
        st = status.lower()
        results = [p for p in results if p.get('status', '').lower() == st]

    if repository and repository.lower() not in ('all', 'all repositories'):
        repo_filter = repository.lower()
        results = [p for p in results if p.get('repository', '').lower() == repo_filter]

    if author and author.lower() not in ('all', 'all authors'):
        auth_filter = author.lower()
        results = [p for p in results if p.get('author', '').lower() == auth_filter or p.get('authorName', '').lower() == auth_filter]

    if search:
        s = search.strip().lower()
        results = [p for p in results if s in p.get('title', '').lower() or s in p.get('description', '').lower()]

    if sort == 'recently-updated':
        results.sort(key=lambda x: x.get('updated_at', 0), reverse=True)
    else:
        results.sort(key=lambda x: x.get('number', 0), reverse=True)

    return results

def get_pull_request(pr_id_or_number):
    """Resolve pull request by ID or number."""
    key = str(pr_id_or_number).strip()
    if key in PULL_REQUESTS:
        return PULL_REQUESTS[key]
    for pr in PULL_REQUESTS.values():
        if str(pr.get('number')) == key or str(pr.get('id')) == key:
            return pr
    return None

def create_pull_request(data, actor_username, repositories=None, dev_profiles=None):
    """Create a new pull request validating repository and branch semantics."""
    title = str(data.get('title', '')).strip()
    if not title:
        return None, "Pull request title is required."

    repository_id = str(data.get('repository', 'devsync-core')).strip()
    repo = None
    if repositories:
        repo = repositories.get(repository_id)
        if not repo:
            # Try searching by name
            for r in repositories.values():
                if r.get('name') == repository_id:
                    repo = r
                    break
    if not repo:
        return None, f"Repository '{repository_id}' does not exist."

    source_branch = str(data.get('sourceBranch') or data.get('source_branch') or '').strip()
    target_branch = str(data.get('targetBranch') or data.get('target_branch') or 'main').strip()

    if not source_branch:
        return None, "Source branch is required."
    if source_branch == target_branch:
        return None, "Source branch and target branch must be different."

    branches = repo.get('branches', ['main', 'develop'])
    if target_branch not in branches:
        return None, f"Target branch '{target_branch}' does not exist in repository '{repo['name']}'."
    if source_branch not in branches:
        # Auto-register valid source branch if missing but supplied in PR
        branches.append(source_branch)

    max_num = max([p.get('number', 0) for p in PULL_REQUESTS.values()] + [40])
    new_number = max_num + 1
    new_id = f"pr-{new_number}"

    author_name = actor_username
    author_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and actor_username in dev_profiles:
        p = dev_profiles[actor_username]
        author_name = p.get('name', actor_username)
        author_avatar = p.get('avatar', author_avatar)

    # Inspect diff from repo branch files
    source_files = repo.get('files', {}).get(source_branch, [])
    diff_summary = []
    for f in source_files:
        diff_summary.append({
            'path': f.get('path', f.get('name')),
            'additions': 12,
            'deletions': 2,
            'diff': f"+ // Code additions for branch {source_branch}\n+ {f.get('content', '')[:120]}"
        })

    new_pr = {
        'id': new_id,
        'number': new_number,
        'title': title,
        'repository': repo['name'],
        'labels': data.get('labels', ['enhancement']),
        'author': actor_username,
        'authorName': author_name,
        'authorAvatar': author_avatar,
        'reviewers': [],
        'commentsCount': 0,
        'status': 'Open',
        'statusClass': 'badge-status-open',
        'created_at': time.time(),
        'updated_at': time.time(),
        'updated': 'Just now',
        'sourceBranch': source_branch,
        'targetBranch': target_branch,
        'description': str(data.get('description', '')).strip(),
        'commitsCount': 1,
        'changedFilesCount': max(1, len(diff_summary)),
        'commits': [
            {
                'hash': secrets.token_hex(4),
                'message': title,
                'author': author_name,
                'time': 'Just now'
            }
        ],
        'changedFiles': diff_summary if diff_summary else [
            {
                'path': 'README.md',
                'additions': 5,
                'deletions': 0,
                'diff': f"+ Proposed changes for {title}"
            }
        ],
        'reviews': []
    }
    PULL_REQUESTS[new_id] = new_pr
    return new_pr, None

def review_pull_request(pr_id_or_number, action, comment_text, actor_username):
    """Approve, request changes, or comment on a pull request."""
    pr = get_pull_request(pr_id_or_number)
    if not pr:
        return None, "Pull request not found."
    act = str(action).strip().lower()
    if act not in ('approve', 'request_changes', 'comment'):
        return None, "Action must be 'approve', 'request_changes', or 'comment'."

    review = {
        'id': f"rev-{secrets.token_hex(4)}",
        'author': actor_username,
        'action': act,
        'comment': str(comment_text or '').strip(),
        'created_at': time.time()
    }
    pr['reviews'].append(review)
    pr['commentsCount'] = len(pr['reviews'])
    pr['updated_at'] = time.time()
    pr['updated'] = 'Just now'
    return review, None

def merge_pull_request(pr_id_or_number, actor_username, repositories=None):
    """
    Perform a genuine Git-style branch merge for the pull request.
    Validates permissions, merges sourceBranch files into targetBranch in repo file tree,
    records an audit commit, and marks the PR as Merged.
    """
    pr = get_pull_request(pr_id_or_number)
    if not pr:
        return None, "Pull request not found."
    if pr.get('status') == 'Merged':
        return None, "Pull request is already merged."
    if pr.get('status') == 'Closed':
        return None, "Cannot merge a closed pull request. Reopen first."

    repo_name = pr.get('repository')
    repo = None
    if repositories:
        repo = repositories.get(repo_name)
        if not repo:
            for r in repositories.values():
                if r.get('name') == repo_name:
                    repo = r
                    break

    if not repo:
        return None, f"Repository '{repo_name}' not found."

    # Check authority: Only Owner or Maintainer can merge PRs
    is_authorized = False
    if repo.get('owner', '').lower() == actor_username.lower():
        is_authorized = True
    else:
        for m in repo.get('members', []):
            if m.get('username', '').lower() == actor_username.lower() and m.get('role') in ('Owner', 'Maintainer'):
                is_authorized = True
                break

    if not is_authorized:
        return None, "Forbidden: You must be a Repository Owner or Maintainer to merge pull requests."

    source_branch = pr.get('sourceBranch')
    target_branch = pr.get('targetBranch', 'main')

    # Perform real file tree merge
    files_tree = repo.setdefault('files', {})
    source_files = files_tree.get(source_branch, [])
    target_files = files_tree.setdefault(target_branch, [])

    # Merge files into target branch
    merged_count = 0
    for s_file in source_files:
        existing = next((f for f in target_files if f.get('path') == s_file.get('path')), None)
        if existing:
            existing['content'] = s_file.get('content', '')
            existing['size'] = s_file.get('size', len(existing['content']))
            existing['updated_at'] = time.time()
            existing['last_commit'] = f"Merge PR #{pr['number']}: {pr['title']}"
            existing['last_actor'] = actor_username
        else:
            new_f = dict(s_file)
            new_f['updated_at'] = time.time()
            new_f['last_commit'] = f"Merge PR #{pr['number']}: {pr['title']}"
            new_f['last_actor'] = actor_username
            target_files.append(new_f)
        merged_count += 1

    # Record commit in audit log
    audit_entry = {
        'id': f"aud_merge_{secrets.token_hex(4)}",
        'action': 'merge_pull_request',
        'branch': target_branch,
        'actor': actor_username,
        'timestamp': time.time(),
        'summary': f"Merged PR #{pr['number']}: {pr['title']} from {source_branch} into {target_branch}",
        'sha256': hashlib.sha256(f"{pr['number']}-{time.time()}".encode('utf-8')).hexdigest()
    }
    repo.setdefault('audit_log', []).append(audit_entry)

    # Set PR status to Merged
    pr['status'] = 'Merged'
    pr['statusClass'] = 'badge-status-merged'
    pr['merged_at'] = time.time()
    pr['merged_by'] = actor_username
    pr['updated_at'] = time.time()
    pr['updated'] = 'Just now'

    return pr, None

# --------------------------------------------------------------------------
# Teams Business Logic
# --------------------------------------------------------------------------
def list_teams():
    """Return all team/project workspace summaries."""
    teams_list = []
    for t in TEAMS.values():
        teams_list.append({
            'id': t['id'],
            'name': t['name'],
            'title': t.get('title', t['name']),
            'description': t.get('description', ''),
            'ownerUsername': t.get('ownerUsername'),
            'ownerName': t.get('ownerName'),
            'language': t.get('language', 'Python'),
            'visibility': t.get('visibility', 'Public'),
            'membersCount': len(t.get('memberUsernames', []))
        })
    return teams_list

def list_team_members(search=None, project=None, role=None):
    """Return filtered team members."""
    results = list(TEAM_MEMBERS)

    if search:
        s = search.strip().lower()
        results = [m for m in results if s in m.get('name', '').lower() or s in m.get('username', '').lower() or s in m.get('email', '').lower()]

    if project and project.lower() not in ('all', 'all projects'):
        p_filter = project.lower()
        results = [m for m in results if any(p_filter in p.lower() for p in m.get('assignedProjects', [])) or p_filter in m.get('projectRoles', {})]

    if role and role.lower() not in ('all', 'all roles'):
        r_filter = role.lower()
        results = [m for m in results if m.get('globalRole', '').lower() == r_filter or any(r_filter == r.lower() for r in m.get('projectRoles', {}).values())]

    return results

def invite_team_member(data, actor_username, dev_profiles=None):
    """Invite or allocate collaborator to a project."""
    target_username = str(data.get('username', '')).strip().lower()
    if not target_username:
        email = str(data.get('email', '')).strip().lower()
        if email and '@' in email:
            target_username = email.split('@')[0]
        elif data.get('name'):
            target_username = str(data.get('name')).lower().replace(' ', '')
    if not target_username:
        return None, "Username or valid email is required."
    project_name = str(data.get('project', 'devsync-core')).strip()
    role = str(data.get('role', 'Collaborator')).strip()
    if not role:
        role = 'Collaborator'

    # Check if member already exists
    member = next((m for m in TEAM_MEMBERS if m['username'].lower() == target_username), None)
    if not member:
        name = target_username
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
        if dev_profiles and target_username in dev_profiles:
            p = dev_profiles[target_username]
            name = p.get('name', target_username)
            avatar = p.get('avatar', avatar)

        member = {
            'id': f"member-{target_username}",
            'name': name,
            'username': target_username,
            'email': f"{target_username}@devsync.dev",
            'avatar': avatar,
            'globalRole': role,
            'contributionsCount': 0,
            'isOnline': True,
            'availability': 'Available',
            'joined': datetime.now().strftime('%b %Y'),
            'assignedProjects': [],
            'projectRoles': {}
        }
        TEAM_MEMBERS.append(member)

    # Assign to project
    proj_title = project_name
    if project_name in TEAMS:
        proj_title = TEAMS[project_name].get('title', project_name)
        if target_username not in TEAMS[project_name]['memberUsernames']:
            TEAMS[project_name]['memberUsernames'].append(target_username)

    if proj_title not in member['assignedProjects']:
        member['assignedProjects'].append(proj_title)
    member['projectRoles'][project_name] = role

    return member, None

def remove_team_member(username, project_name=None):
    """Remove member from a project or from team."""
    u = username.strip().lower()
    member = next((m for m in TEAM_MEMBERS if m['username'].lower() == u), None)
    if not member:
        return False, "Member not found."

    if member.get('globalRole') == 'Owner' and not project_name:
        return False, "Primary owner cannot be removed from workspace."

    if project_name:
        if project_name in member.get('projectRoles', {}):
            del member['projectRoles'][project_name]
        # Remove from assignedProjects
        proj_title = project_name
        if project_name in TEAMS:
            proj_title = TEAMS[project_name].get('title', project_name)
            if u in TEAMS[project_name]['memberUsernames']:
                TEAMS[project_name]['memberUsernames'].remove(u)
        member['assignedProjects'] = [p for p in member.get('assignedProjects', []) if p != proj_title]
    else:
        TEAM_MEMBERS.remove(member)

    return True, None

# --------------------------------------------------------------------------
# DevSync Chat Business Logic
# --------------------------------------------------------------------------
def list_conversations(current_user_username, dev_profiles=None):
    """Return all conversations visible to the current user."""
    u = current_user_username.strip().lower()
    results = []
    for conv in CONVERSATIONS.values():
        members_lower = [m.lower() for m in conv.get('members', [])]
        if u in members_lower or conv.get('type') == 'public_group':
            c_copy = dict(conv)
            # For direct messages, dynamically compute title & avatar for the counterparty
            if c_copy.get('type') == 'direct':
                counterparties = [m for m in conv.get('members', []) if m.lower() != u]
                if counterparties:
                    other_u = counterparties[0]
                    if dev_profiles and other_u in dev_profiles:
                        p = dev_profiles[other_u]
                        c_copy['title'] = p.get('fullName') or p.get('name') or other_u
                        if p.get('avatarUrl') or p.get('avatar'):
                            c_copy['avatar'] = p.get('avatarUrl') or p.get('avatar')
                    elif other_u.lower() == 'balajikumar':
                        c_copy['title'] = 'Balaji'
                        c_copy['avatar'] = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
                    elif other_u.lower() == 'naveen3438':
                        c_copy['title'] = 'Naveen Kumar D'
                        c_copy['avatar'] = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
                    elif other_u.lower() == 'priyas':
                        c_copy['title'] = 'Priya S'
                        c_copy['avatar'] = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
                    elif other_u.lower() == 'karthik':
                        c_copy['title'] = 'Karthik'
                        c_copy['avatar'] = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80'
                    else:
                        c_copy['title'] = other_u
            # Fetch latest message preview
            msgs = MESSAGES.get(conv['id'], [])
            if msgs:
                last_m = msgs[-1]
                c_copy['lastMessage'] = last_m.get('text', '')
                c_copy['lastMessageTime'] = last_m.get('time', 'Recently')
                c_copy['updated_at'] = last_m.get('timestamp', c_copy.get('updated_at', 0))
            results.append(c_copy)
    results.sort(key=lambda x: x.get('updated_at', 0), reverse=True)
    return results

def get_messages(conversation_id, current_user_username, page=1, page_size=50):
    """Get paginated message stream for a conversation."""
    conv = CONVERSATIONS.get(conversation_id)
    if not conv:
        if conversation_id in CHANNEL_MESSAGES or any(
            any(ch.get('id') == conversation_id for ch in comm.get('channels', []))
            for comm in COMMUNITIES.values()
        ):
            return get_channel_messages(conversation_id), None
        return None, "Conversation not found."

    u = current_user_username.strip().lower()
    members_lower = [m.lower() for m in conv.get('members', [])]
    if u not in members_lower and conv.get('type') != 'public_group':
        return None, "Forbidden: You are not a member of this conversation."

    all_msgs = MESSAGES.get(conversation_id, [])
    # Mark messages as read by current user
    for m in all_msgs:
        if m.get('sender', '').lower() != u:
            m['status'] = 'read'
    conv['unreadCount'] = 0

    return all_msgs, None

def post_message(conversation_id, text, current_user_username, reply_to=None, attachment=None, dev_profiles=None):
    """Post a message into a conversation."""
    conv = CONVERSATIONS.get(conversation_id)
    if not conv:
        if conversation_id in CHANNEL_MESSAGES or any(
            any(ch.get('id') == conversation_id for ch in comm.get('channels', []))
            for comm in COMMUNITIES.values()
        ):
            return post_channel_message(conversation_id, text, current_user_username, dev_profiles)
        return None, "Conversation not found."

    u = current_user_username.strip().lower()
    members_lower = [m.lower() for m in conv.get('members', [])]
    if u not in members_lower and conv.get('type') != 'public_group':
        return None, "Forbidden: You are not a member of this conversation."

    t = str(text or '').strip()
    if not t and not attachment:
        return None, "Message cannot be empty."

    sender_name = current_user_username
    sender_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and current_user_username in dev_profiles:
        p = dev_profiles[current_user_username]
        sender_name = p.get('name', current_user_username)
        sender_avatar = p.get('avatar', sender_avatar)

    new_msg = {
        'id': f"msg_{secrets.token_hex(6)}",
        'conversation_id': conversation_id,
        'sender': current_user_username,
        'senderName': sender_name,
        'senderAvatar': sender_avatar,
        'text': t,
        'timestamp': time.time(),
        'time': datetime.now().strftime('%I:%M %p').lstrip('0'),
        'status': 'sent',
        'reply_to': reply_to,
        'replyTo': reply_to,
        'attachment': attachment,
        'reactions': {}
    }

    MESSAGES.setdefault(conversation_id, []).append(new_msg)
    conv['lastMessage'] = t if t else "Sent an attachment"
    conv['lastMessageTime'] = new_msg['time']
    conv['updated_at'] = time.time()
    return new_msg, None

def react_to_message(conversation_id, message_id, emoji, actor_username):
    """Add or toggle an emoji reaction on a message."""
    msgs = MESSAGES.get(conversation_id, [])
    msg = next((m for m in msgs if m.get('id') == message_id), None)
    if not msg:
        for cid, clist in MESSAGES.items():
            found = next((m for m in clist if m.get('id') == message_id), None)
            if found:
                msg = found
                break
    if not msg:
        for chid, chlist in CHANNEL_MESSAGES.items():
            found = next((m for m in chlist if m.get('id') == message_id), None)
            if found:
                msg = found
                break
    if not msg:
        return None, "Message not found."

    reactions = msg.setdefault('reactions', {})
    user_list = reactions.setdefault(emoji, [])
    if actor_username in user_list:
        user_list.remove(actor_username)
        if not user_list:
            del reactions[emoji]
    else:
        user_list.append(actor_username)
    return reactions, None

def create_conversation(data, actor_username, dev_profiles=None):
    """Create a new 1:1 direct chat or group conversation."""
    conv_type = data.get('type', 'direct')
    raw_members = list(data.get('members', []))
    if not raw_members and data.get('participants'):
        for p in data['participants']:
            u = p.get('username') or p.get('name')
            if u:
                raw_members.append(str(u).lower().replace(' ', ''))
    if data.get('recipientUsername'):
        raw_members.append(str(data['recipientUsername']).lower().strip())
    members = list(set([actor_username] + raw_members))

    if conv_type == 'direct':
        if len(members) < 2:
            return None, "Direct conversation requires at least one other participant."
        other_user = [m for m in members if m.lower() != actor_username.lower()][0]
        # Check if conversation already exists between these two
        for c in CONVERSATIONS.values():
            if c.get('type') == 'direct':
                m_set = set([m.lower() for m in c.get('members', [])])
                if m_set == set([actor_username.lower(), other_user.lower()]):
                    return c, None

        title = other_user
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
        if dev_profiles and other_user in dev_profiles:
            p = dev_profiles[other_user]
            title = p.get('name', other_user)
            avatar = p.get('avatar', avatar)

        conv_id = f"conv-direct-{other_user}"
        new_conv = {
            'id': conv_id,
            'type': 'direct',
            'title': title,
            'avatar': avatar,
            'members': members,
            'admins': [actor_username],
            'isOnline': True,
            'unreadCount': 0,
            'updated_at': time.time(),
            'lastMessage': 'Conversation started',
            'lastMessageTime': 'Just now'
        }
    else:  # 'group'
        title = str(data.get('title', 'New Group')).strip()
        if not title:
            return None, "Group title is required."
        conv_id = f"conv-grp-{secrets.token_hex(4)}"
        new_conv = {
            'id': conv_id,
            'type': 'group',
            'title': title,
            'avatar': '',
            'description': str(data.get('description', '')).strip(),
            'members': members,
            'admins': [actor_username],
            'isOnline': False,
            'unreadCount': 0,
            'updated_at': time.time(),
            'lastMessage': f"{actor_username} created group '{title}'",
            'lastMessageTime': 'Just now'
        }

    CONVERSATIONS[conv_id] = new_conv
    return new_conv, None

# --------------------------------------------------------------------------
# Communities & Channels
# --------------------------------------------------------------------------
def list_communities():
    """Return all available communities and their channels."""
    return list(COMMUNITIES.values())

def get_channel_messages(channel_id):
    """Return messages for a specific community text channel."""
    msgs = CHANNEL_MESSAGES.get(channel_id, [])
    for m in msgs:
        m.setdefault('sender', m.get('author', 'Developer'))
        m.setdefault('senderName', m.get('author', 'Developer'))
        m.setdefault('senderAvatar', m.get('authorAvatar', ''))
    return msgs

def post_channel_message(channel_id, text, actor_username, dev_profiles=None):
    """Post message to a community text channel."""
    t = str(text).strip()
    if not t:
        return None, "Message cannot be empty."

    author_name = actor_username
    author_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and actor_username in dev_profiles:
        p = dev_profiles[actor_username]
        author_name = p.get('name', actor_username)
        author_avatar = p.get('avatar', author_avatar)

    msg = {
        'id': f"cmsg_{secrets.token_hex(6)}",
        'channelId': channel_id,
        'author': author_name,
        'authorAvatar': author_avatar,
        'sender': actor_username,
        'senderName': author_name,
        'senderAvatar': author_avatar,
        'time': datetime.now().strftime('%I:%M %p').lstrip('0'),
        'text': t,
        'reactions': {}
    }
    CHANNEL_MESSAGES.setdefault(channel_id, []).append(msg)
    return msg, None

# --------------------------------------------------------------------------
# Developer 24-Hour Status Updates
# --------------------------------------------------------------------------
def list_active_statuses():
    """Return non-expired statuses within 24 hours."""
    now_t = time.time()
    active = [s for s in STATUS_UPDATES if s.get('expires_at', 0) > now_t]
    active.sort(key=lambda x: x.get('created_at', 0), reverse=True)
    return active

def publish_status(text, actor_username, audience='everyone', media=None, dev_profiles=None):
    """Publish a 24-hour temporary status update."""
    t = str(text).strip()
    if not t:
        return None, "Status text is required."

    author_name = actor_username
    author_avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80"
    if dev_profiles and actor_username in dev_profiles:
        p = dev_profiles[actor_username]
        author_name = p.get('name', actor_username)
        author_avatar = p.get('avatar', author_avatar)

    new_stat = {
        'id': f"stat_{secrets.token_hex(6)}",
        'author': actor_username,
        'authorName': author_name,
        'authorAvatar': author_avatar,
        'text': t,
        'media': media,
        'audience': audience if audience in ('everyone', 'team', 'connections') else 'everyone',
        'created_at': time.time(),
        'expires_at': time.time() + 24 * 3600
    }
    STATUS_UPDATES.insert(0, new_stat)
    return new_stat, None

def delete_status(status_id, actor_username):
    """Delete status if owned by actor."""
    for s in list(STATUS_UPDATES):
        if s.get('id') == status_id:
            if s.get('author') != actor_username:
                return False, "Forbidden: You can only delete your own status."
            STATUS_UPDATES.remove(s)
            return True, None
    return False, "Status not found."


# ==========================================================================
# HTTP Request Handlers (Invoked by DevSync Server Dispatcher)
# ==========================================================================
import urllib.parse

def handle_get(handler, path, url_parts, auth_user=None, dev_profiles=None):
    """Handle GET requests for Issues, Pull Requests, Teams, and Chat."""
    # 1. Issues List
    if path in ('/api/v1/issues', '/api/issues', '/api/v1/issues/', '/api/issues/'):
        query = urllib.parse.parse_qs(url_parts.query)
        status = query.get('status', [''])[0].strip()
        repo = (query.get('repo') or query.get('repository') or [''])[0].strip()
        label = query.get('label', [''])[0].strip()
        author = query.get('author', [''])[0].strip()
        search = (query.get('q') or query.get('search') or [''])[0].strip()
        sort = query.get('sort', ['newest'])[0].strip()

        issues_res = list_issues(status=status, repository=repo, label=label, author=author, search=search, sort=sort)
        handler.send_json(200, issues_res)
        return True

    # 2. Issue Details
    m_issue = re.match(r'^/api/(?:v1/)?issues/([^/]+)/?$', path)
    if m_issue:
        issue_id = m_issue.group(1)
        issue = get_issue(issue_id)
        if not issue:
            handler.send_json(404, {'error': f'Issue {issue_id} not found'})
            return True
        handler.send_json(200, issue)
        return True

    # 3. Pull Requests List
    if path in ('/api/v1/pull-requests', '/api/pull-requests', '/api/v1/pull-requests/', '/api/pull-requests/'):
        query = urllib.parse.parse_qs(url_parts.query)
        status = query.get('status', [''])[0].strip()
        repo = (query.get('repo') or query.get('repository') or [''])[0].strip()
        author = query.get('author', [''])[0].strip()
        search = (query.get('q') or query.get('search') or [''])[0].strip()
        sort = query.get('sort', ['newest'])[0].strip()

        pr_res = list_pull_requests(status=status, repository=repo, author=author, search=search, sort=sort)
        handler.send_json(200, pr_res)
        return True

    # 4. Pull Request Details
    m_pr = re.match(r'^/api/(?:v1/)?pull-requests/([^/]+)/?$', path)
    if m_pr:
        pr_id = m_pr.group(1)
        pr = get_pull_request(pr_id)
        if not pr:
            handler.send_json(404, {'error': f'Pull request {pr_id} not found'})
            return True
        handler.send_json(200, pr)
        return True

    # 5. Teams List
    if path in ('/api/v1/teams', '/api/teams', '/api/v1/teams/', '/api/teams/'):
        handler.send_json(200, list_teams())
        return True

    # 6. Team Members List
    if path in ('/api/v1/teams/members', '/api/teams/members', '/api/v1/teams/members/', '/api/teams/members/'):
        query = urllib.parse.parse_qs(url_parts.query)
        search = query.get('search', [''])[0].strip()
        project = query.get('project', [''])[0].strip()
        role = query.get('role', [''])[0].strip()

        members = list_team_members(search=search, project=project, role=role)
        handler.send_json(200, members)
        return True

    # 7. Chat Conversations
    if path in ('/api/v1/chat/conversations', '/api/v1/chat/conversations/'):
        caller = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        handler.send_json(200, list_conversations(caller, dev_profiles=dev_profiles))
        return True

    # 8. Chat Messages
    m_chat_msgs = re.match(r'^/api/(?:v1/)?chat/conversations/([^/]+)/messages/?$', path)
    if m_chat_msgs:
        conv_id = m_chat_msgs.group(1)
        caller = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        msgs, err = get_messages(conv_id, caller)
        if err:
            handler.send_json(403 if 'Forbidden' in err else 404, {'error': err})
            return True
        handler.send_json(200, msgs)
        return True

    # 9. Communities & Channels
    if path in ('/api/v1/chat/communities', '/api/v1/chat/communities/', '/api/v1/community/channels', '/api/v1/community/channels/'):
        if 'community/channels' in path:
            comms = list_communities()
            all_channels = []
            for c in comms:
                all_channels.extend(c.get('channels', []))
            handler.send_json(200, all_channels)
        else:
            handler.send_json(200, list_communities())
        return True

    # 10. Channel Messages
    m_ch_msgs = re.match(r'^/api/(?:v1/)?(?:chat/communities/[^/]+/channels|community/channels|chat/channels)/([^/]+)/messages/?$', path)
    if m_ch_msgs:
        ch_id = m_ch_msgs.group(1)
        msgs = get_channel_messages(ch_id)
        handler.send_json(200, msgs)
        return True

    # 11. Chat Statuses
    if path in ('/api/v1/chat/statuses', '/api/v1/chat/statuses/'):
        handler.send_json(200, list_active_statuses())
        return True

    return False

def handle_post(handler, path, url_parts, auth_user, dev_profiles, repositories, save_fn):
    """Handle POST requests for Issues, Pull Requests, Teams, and Chat."""
    # 1. Create Issue
    if path in ('/api/v1/issues', '/api/issues', '/api/v1/issues/', '/api/issues/'):
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        new_issue, err = create_issue(body, actor, dev_profiles)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, new_issue)
        return True

    # 2. Add Issue Comment
    m_iss_comm = re.match(r'^/api/(?:v1/)?issues/([^/]+)/comments/?$', path)
    if m_iss_comm:
        issue_id = m_iss_comm.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        comment_text = body.get('text') or body.get('comment') or body.get('body') or ''
        comment, err = add_issue_comment(issue_id, comment_text, actor, dev_profiles)
        if err:
            status_code = 404 if 'not found' in err.lower() else 400
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        resp_obj = {'success': True, 'comment': comment}
        resp_obj.update(comment)
        handler.send_json(201, resp_obj)
        return True

    # 3. Close Issue
    m_iss_close = re.match(r'^/api/(?:v1/)?issues/([^/]+)/close/?$', path)
    if m_iss_close:
        issue_id = m_iss_close.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        issue, err = set_issue_status(issue_id, 'Closed', actor)
        if err:
            status_code = 404 if 'not found' in err.lower() else 400
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, issue)
        return True

    # 4. Reopen Issue
    m_iss_reopen = re.match(r'^/api/(?:v1/)?issues/([^/]+)/reopen/?$', path)
    if m_iss_reopen:
        issue_id = m_iss_reopen.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        issue, err = set_issue_status(issue_id, 'Open', actor)
        if err:
            status_code = 404 if 'not found' in err.lower() else 400
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, issue)
        return True

    # 5. Create Pull Request
    if path in ('/api/v1/pull-requests', '/api/pull-requests', '/api/v1/pull-requests/', '/api/pull-requests/'):
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        new_pr, err = create_pull_request(body, actor, repositories, dev_profiles)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, new_pr)
        return True

    # 6. Review / Comment Pull Request
    m_pr_rev = re.match(r'^/api/(?:v1/)?pull-requests/([^/]+)/(?:review|comments)/?$', path)
    if m_pr_rev:
        pr_id = m_pr_rev.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        action = body.get('action', 'comment')
        comment_text = body.get('comment') or body.get('text') or body.get('body') or ''
        rev, err = review_pull_request(pr_id, action, comment_text, actor)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        pr = get_pull_request(pr_id)
        resp_obj = {'success': True, 'review': rev, 'reviews': pr.get('reviews', []) if pr else [rev], 'pull_request': pr}
        resp_obj.update(rev)
        handler.send_json(200, resp_obj)
        return True

    # 7. Close Pull Request
    m_pr_close = re.match(r'^/api/(?:v1/)?pull-requests/([^/]+)/close/?$', path)
    if m_pr_close:
        pr_id = m_pr_close.group(1)
        pr = get_pull_request(pr_id)
        if not pr:
            handler.send_json(404, {'error': 'Pull request not found'})
            return True
        pr['status'] = 'Closed'
        pr['statusClass'] = 'badge-status-closed'
        pr['updated_at'] = time.time()
        pr['updated'] = 'Just now'
        save_fn()
        handler.send_json(200, pr)
        return True

    # 8. Merge Pull Request (Real branch merge)
    m_pr_merge = re.match(r'^/api/(?:v1/)?pull-requests/([^/]+)/merge/?$', path)
    if m_pr_merge:
        pr_id = m_pr_merge.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'balajikumar').strip().lower()
        merged_pr, err = merge_pull_request(pr_id, actor, repositories)
        if err:
            status_code = 404 if 'not found' in err.lower() else (403 if 'forbidden' in err.lower() else 400)
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, {
            'success': True,
            'merged': True,
            'status': merged_pr.get('status', 'Merged'),
            'message': f"Pull request #{merged_pr['number']} successfully merged into '{merged_pr['targetBranch']}'.",
            'pull_request': merged_pr
        })
        return True

    # 9. Invite Team Member
    if path in ('/api/v1/teams/members/invite', '/api/teams/members/invite', '/api/v1/teams/members/invite/', '/api/teams/members/invite/'):
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'balajikumar').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        member, err = invite_team_member(body, actor, dev_profiles)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, {
            'success': True,
            'message': f"Member @{member['username']} added to project.",
            'member': member
        })
        return True

    # 10. Create Chat Conversation
    if path in ('/api/v1/chat/conversations', '/api/v1/chat/conversations/'):
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        conv, err = create_conversation(body, actor, dev_profiles)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, conv)
        return True

    # 11. Post Chat Message
    m_post_msg = re.match(r'^/api/(?:v1/)?chat/conversations/([^/]+)/messages/?$', path)
    if m_post_msg:
        conv_id = m_post_msg.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        text_payload = body.get('text') or body.get('content') or body.get('message') or ''
        msg, err = post_message(
            conv_id,
            text_payload,
            actor,
            reply_to=body.get('reply_to') or body.get('replyTo'),
            attachment=body.get('attachment'),
            dev_profiles=dev_profiles
        )
        if err:
            status_code = 404 if 'not found' in err.lower() else (403 if 'forbidden' in err.lower() else 400)
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(201, msg)
        return True

    # 12. Mark Conversation as Read
    m_read_conv = re.match(r'^/api/(?:v1/)?chat/conversations/([^/]+)/read/?$', path)
    if m_read_conv:
        conv_id = m_read_conv.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        get_messages(conv_id, actor)
        save_fn()
        handler.send_json(200, {'success': True, 'conversation_id': conv_id})
        return True

    # 13. React to Message
    m_react = re.match(r'^/api/(?:v1/)?chat/messages/([^/]+)/(?:react|reactions)/?$', path)
    if m_react:
        msg_id = m_react.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        conv_id = body.get('conversation_id', 'conv-direct-balaji')
        emoji = body.get('emoji') or body.get('reaction') or '👍'
        reactions, err = react_to_message(conv_id, msg_id, emoji, actor)
        if err:
            status_code = 404 if 'not found' in err.lower() else 400
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, {'success': True, 'reactions': reactions})
        return True

    # 14. Post Channel Message
    m_comm_post = re.match(r'^/api/(?:v1/)?(?:chat/communities/[^/]+/channels|community/channels|chat/channels)/([^/]+)/messages/?$', path)
    if m_comm_post:
        ch_id = m_comm_post.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        msg_text = body.get('text') or body.get('content') or body.get('message') or ''
        msg, err = post_channel_message(ch_id, msg_text, actor, dev_profiles)
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, msg)
        return True

    # 15. Publish Status
    if path in ('/api/v1/chat/statuses', '/api/v1/chat/statuses/'):
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}
        new_stat, err = publish_status(
            body.get('text', ''),
            actor,
            audience=body.get('audience', 'everyone'),
            media=body.get('media'),
            dev_profiles=dev_profiles
        )
        if err:
            handler.send_json(400, {'error': err})
            return True
        save_fn()
        handler.send_json(201, new_stat)
        return True

    return False

def handle_patch(handler, path, url_parts, auth_user, save_fn):
    """Handle PATCH requests for Issues and Teams."""
    # 1. Update Issue
    m_iss_patch = re.match(r'^/api/(?:v1/)?issues/([^/]+)/?$', path)
    if m_iss_patch:
        issue_id = m_iss_patch.group(1)
        issue = get_issue(issue_id)
        if not issue:
            handler.send_json(404, {'error': 'Issue not found'})
            return True
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        for k in ('title', 'description', 'repository', 'labels', 'status'):
            if k in body:
                issue[k] = body[k]
        issue['updated_at'] = time.time()
        issue['updated'] = 'Just now'
        save_fn()
        handler.send_json(200, issue)
        return True

    # 2. Update Team Member
    m_tm_patch = re.match(r'^/api/(?:v1/)?teams/members/([^/]+)/?$', path)
    if m_tm_patch:
        target_username = m_tm_patch.group(1).lower()
        member = next((m for m in TEAM_MEMBERS if m['username'].lower() == target_username), None)
        if not member:
            handler.send_json(404, {'error': f'Team member @{target_username} not found'})
            return True
        length = int(handler.headers.get('Content-Length', 0))
        post_data = handler.rfile.read(length) if length > 0 else b'{}'
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            handler.send_json(400, {'error': 'Invalid JSON body'})
            return True
        VALID_ROLES = {
            'Maintainer', 'Lead Maintainer', 'Collaborator', 'Viewer', 'Contributor',
            'Core Contributor', 'Admin', 'Owner', 'Developer', 'Fullstack Developer',
            'Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Lead'
        }
        VALID_ROLES_MAP = {r.lower(): r for r in VALID_ROLES}
        if 'globalRole' in body:
            g_role_raw = str(body['globalRole']).strip()
            if g_role_raw.lower() not in VALID_ROLES_MAP:
                handler.send_json(400, {'error': f'Invalid globalRole: {g_role_raw}'})
                return True
            member['globalRole'] = VALID_ROLES_MAP[g_role_raw.lower()]
        if 'availability' in body:
            member['availability'] = str(body['availability']).strip()
        if 'role' in body or ('project' in body and 'role' in body):
            role_val_raw = str(body.get('role', '')).strip()
            if role_val_raw.lower() not in VALID_ROLES_MAP:
                handler.send_json(400, {'error': f'Invalid role: {role_val_raw}'})
                return True
            proj = str(body.get('project', 'devsync-core')).strip()
            member.setdefault('projectRoles', {})[proj] = VALID_ROLES_MAP[role_val_raw.lower()]
        save_fn()
        handler.send_json(200, {'success': True, 'member': member})
        return True

    return False

def handle_delete(handler, path, url_parts, auth_user, save_fn):
    """Handle DELETE requests for Teams and Chat Statuses."""
    # 1. Remove Team Member
    m_tm_del = re.match(r'^/api/(?:v1/)?teams/members/([^/]+)/?$', path)
    if m_tm_del:
        target_username = m_tm_del.group(1).lower()
        query = urllib.parse.parse_qs(url_parts.query)
        project_filter = query.get('project', [None])[0]
        ok, err = remove_team_member(target_username, project_filter)
        if not ok:
            status_code = 404 if 'not found' in err.lower() else 400
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, {'success': True, 'message': f'Member @{target_username} removed.'})
        return True

    # 2. Delete Chat Status
    m_stat_del = re.match(r'^/api/(?:v1/)?chat/statuses/([^/]+)/?$', path)
    if m_stat_del:
        status_id = m_stat_del.group(1)
        actor = auth_user['username'].lower() if auth_user else handler.headers.get('X-DevSync-User', 'naveen3438').strip().lower()
        ok, err = delete_status(status_id, actor)
        if not ok:
            status_code = 403 if 'Forbidden' in err else 404
            handler.send_json(status_code, {'error': err})
            return True
        save_fn()
        handler.send_json(200, {'success': True, 'message': 'Status deleted successfully.'})
        return True

    return False
