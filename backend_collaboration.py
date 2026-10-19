"""
DevSync Backend Collaboration Engine
Manages Repositories, Role-Based Access Control, Branch-Aware File Storage,
Auditable Git-Style Changes, Activity Events, and Project Pulse Time-Series Aggregation.
"""

import os
import re
import time
import json
import secrets
import hashlib
import datetime

NOW = time.time()

# --------------------------------------------------------------------------
# Initial / Default Repositories Dataset
# --------------------------------------------------------------------------
INITIAL_REPOSITORIES = {
    'devsync-core': {
        'id': 'repo-devsync',
        'name': 'devsync-core',
        'owner': 'balajikumar',
        'description': 'Core backend microservices, async worker pipelines, and developer collaboration services for DevSync.',
        'language': 'Python',
        'languageColor': '#3572A5',
        'visibility': 'Private',
        'defaultBranch': 'main',
        'created_at': NOW - 30 * 86400,
        'updated_at': NOW - 7200,
        'stars': 28,
        'forks': 5,
        'branches': ['main', 'develop', 'feature/authentication', 'hotfix/session-expiry'],
        'members': [
            {
                'username': 'balajikumar',
                'role': 'Owner',
                'responsibility': 'Backend & Architecture',
                'assignedTasks': ['Database connection pooling', 'Redis session engine'],
                'joined_at': NOW - 30 * 86400
            },
            {
                'username': 'naveen3438',
                'role': 'Maintainer',
                'responsibility': 'Fullstack & API Integration',
                'assignedTasks': ['Branch-aware file upload pipeline', 'Developer profile endpoints'],
                'joined_at': NOW - 25 * 86400
            },
            {
                'username': 'priyas',
                'role': 'Collaborator',
                'responsibility': 'Frontend & UI Components',
                'assignedTasks': ['Project Pulse activity graph', 'Repository vertical navigation drawer'],
                'joined_at': NOW - 20 * 86400
            },
            {
                'username': 'ananyaroy',
                'role': 'Collaborator',
                'responsibility': 'DevOps & Cloud Pipelines',
                'assignedTasks': ['Docker deployment scripts', 'Nginx configuration'],
                'joined_at': NOW - 18 * 86400
            },
            {
                'username': 'vikramrao',
                'role': 'Viewer',
                'responsibility': 'Quality Assurance & Code Review',
                'assignedTasks': ['Security review of token exchange'],
                'joined_at': NOW - 10 * 86400
            }
        ],
        'milestones': [
            {
                'id': 'm-1',
                'title': 'v1.0 Core Collaboration Engine',
                'description': 'Initial release with repository management, real-time activity and developer profiles.',
                'due_date': '2026-11-01',
                'status': 'open',
                'progress': 75
            },
            {
                'id': 'm-2',
                'title': 'v0.9 MVP Infrastructure',
                'description': 'Foundational data models, PBKDF2 hashing, and static page architecture.',
                'due_date': '2026-10-15',
                'status': 'completed',
                'completed_at': NOW - 4 * 86400,
                'progress': 100
            }
        ],
        'tasks': [
            {
                'id': 't-1',
                'title': 'Implement branch-aware file uploads with checksum verification',
                'assigned_to': 'naveen3438',
                'responsibility': 'Backend',
                'status': 'completed',
                'completed_at': NOW - 1 * 86400,
                'milestone_id': 'm-1'
            },
            {
                'id': 't-2',
                'title': 'Build DevSync Project Pulse activity timeline and aggregations',
                'assigned_to': 'priyas',
                'responsibility': 'Frontend',
                'status': 'completed',
                'completed_at': NOW - 2 * 86400,
                'milestone_id': 'm-1'
            },
            {
                'id': 't-3',
                'title': 'Implement repository vertical navigation sidebar with drawer mode',
                'assigned_to': 'priyas',
                'responsibility': 'Frontend',
                'status': 'completed',
                'completed_at': NOW - 3 * 86400,
                'milestone_id': 'm-1'
            },
            {
                'id': 't-4',
                'title': 'Enforce repository role permissions on member invitations and deletions',
                'assigned_to': 'balajikumar',
                'responsibility': 'Backend',
                'status': 'completed',
                'completed_at': NOW - 5 * 86400,
                'milestone_id': 'm-1'
            },
            {
                'id': 't-5',
                'title': 'Add multi-branch code browsing and file tree view',
                'assigned_to': 'naveen3438',
                'responsibility': 'Fullstack',
                'status': 'open',
                'milestone_id': 'm-1'
            },
            {
                'id': 't-6',
                'title': 'Optimize PostgreSQL property graph traversal queries',
                'assigned_to': 'ananyaroy',
                'responsibility': 'DevOps',
                'status': 'open',
                'milestone_id': 'm-1'
            }
        ],
        'files': {
            'main': [
                {
                    'path': 'apps/api/views.py',
                    'name': 'views.py',
                    'type': 'file',
                    'size': 3420,
                    'updated_at': NOW - 7200,
                    'last_commit': 'Refactor API endpoints and serializers',
                    'last_actor': 'balajikumar',
                    'content': '# DevSync Core API Views\nfrom rest_framework.views import APIView\nfrom rest_framework.response import Response\n\nclass RepositoryListView(APIView):\n    def get(self, request):\n        return Response({"status": "ok"})\n'
                },
                {
                    'path': 'apps/core/models.py',
                    'name': 'models.py',
                    'type': 'file',
                    'size': 2180,
                    'updated_at': NOW - 86400,
                    'last_commit': 'Add branch-aware repository model',
                    'last_actor': 'naveen3438',
                    'content': '# DevSync Core Models\nimport uuid\nfrom django.db import models\n\nclass Repository(models.Model):\n    name = models.CharField(max_length=255)\n'
                },
                {
                    'path': 'config/settings.py',
                    'name': 'settings.py',
                    'type': 'file',
                    'size': 4120,
                    'updated_at': NOW - 3 * 86400,
                    'last_commit': 'Configure PBKDF2 hashers and CORS headers',
                    'last_actor': 'balajikumar',
                    'content': '# DevSync Settings\nDEBUG = False\n'
                },
                {
                    'path': 'manage.py',
                    'name': 'manage.py',
                    'type': 'file',
                    'size': 820,
                    'updated_at': NOW - 14 * 86400,
                    'last_commit': 'Initialize Django application environment',
                    'last_actor': 'balajikumar',
                    'content': '#!/usr/bin/env python\nimport os, sys\n'
                },
                {
                    'path': 'README.md',
                    'name': 'README.md',
                    'type': 'file',
                    'size': 1450,
                    'updated_at': NOW - 7200,
                    'last_commit': 'Update architectural overview and branch workflows',
                    'last_actor': 'balajikumar',
                    'content': '# DevSync Core Services\nHigh performance developer collaboration backend written in Python 3.12, utilizing Django REST Framework, PostgreSQL, and Redis caching.\n\n## Architecture Highlights\n- Branch-aware repository file tree management\n- Real-time DevSync Project Pulse activity timeline\n- Strict role-based permissions matrix (Owner, Maintainer, Collaborator, Viewer)\n'
                }
            ],
            'develop': [
                {
                    'path': 'apps/pulse/engine.py',
                    'name': 'engine.py',
                    'type': 'file',
                    'size': 2840,
                    'updated_at': NOW - 900,
                    'last_commit': 'Add time-series aggregation buckets for Project Pulse',
                    'last_actor': 'naveen3438',
                    'content': '# DevSync Pulse Engine - Real-time activity timeline calculation\n'
                },
                {
                    'path': 'README.md',
                    'name': 'README.md',
                    'type': 'file',
                    'size': 1520,
                    'updated_at': NOW - 900,
                    'last_commit': 'Update develop branch documentation',
                    'last_actor': 'naveen3438',
                    'content': '# DevSync Core (Develop Branch)\nContains bleeding-edge features for testing and validation.\n'
                }
            ],
            'feature/authentication': [
                {
                    'path': 'apps/auth/otp.py',
                    'name': 'otp.py',
                    'type': 'file',
                    'size': 1920,
                    'updated_at': NOW - 5000,
                    'last_commit': 'Implement single-use verification token',
                    'last_actor': 'naveen3438',
                    'content': '# DevSync Email OTP Module\n'
                }
            ]
        },
        'attachments': [
            {
                'id': 'att-1',
                'name': 'devsync_architecture_diagram.pdf',
                'size': 845200,
                'uploaded_by': 'balajikumar',
                'uploaded_at': NOW - 4 * 86400,
                'file_type': 'application/pdf',
                'description': 'Comprehensive microservices topology and data flow diagram'
            },
            {
                'id': 'att-2',
                'name': 'database_erd_schema.png',
                'size': 524100,
                'uploaded_by': 'naveen3438',
                'uploaded_at': NOW - 2 * 86400,
                'file_type': 'image/png',
                'description': 'PostgreSQL relational schema and foreign key mapping'
            }
        ],
        'audit_log': [
            {
                'id': 'aud-1',
                'action': 'file_upload',
                'branch': 'develop',
                'file_path': 'apps/pulse/engine.py',
                'actor': 'naveen3438',
                'timestamp': NOW - 900,
                'summary': 'Add time-series aggregation buckets for Project Pulse',
                'sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            }
        ]
    },
    'chaturyanew': {
        'id': 'repo-chaturya',
        'name': 'chaturyanew',
        'owner': 'naveen3438',
        'description': 'Student developers club website built with Django. Event registrations, workshops and community features.',
        'language': 'Python',
        'languageColor': '#3572A5',
        'visibility': 'Public',
        'defaultBranch': 'main',
        'created_at': NOW - 45 * 86400,
        'updated_at': NOW - 2 * 86400,
        'stars': 28,
        'forks': 6,
        'branches': ['main', 'develop'],
        'members': [
            {
                'username': 'naveen3438',
                'role': 'Owner',
                'responsibility': 'Lead Maintainer & Backend',
                'assignedTasks': ['QR code event check-in system', 'Registration portal'],
                'joined_at': NOW - 45 * 86400
            },
            {
                'username': 'priyas',
                'role': 'Collaborator',
                'responsibility': 'Frontend UI',
                'assignedTasks': ['Event card carousel', 'Club registration form'],
                'joined_at': NOW - 30 * 86400
            },
            {
                'username': 'balajikumar',
                'role': 'Collaborator',
                'responsibility': 'Database & Deployment',
                'assignedTasks': ['PostgreSQL migration scripts'],
                'joined_at': NOW - 25 * 86400
            }
        ],
        'milestones': [
            {
                'id': 'm-chat-1',
                'title': 'Annual Tech Fest Portal',
                'description': 'Event registration and live leaderboard system',
                'due_date': '2026-11-15',
                'status': 'open',
                'progress': 60
            }
        ],
        'tasks': [
            {
                'id': 't-chat-1',
                'title': 'Add QR code verification to registration emails',
                'assigned_to': 'naveen3438',
                'responsibility': 'Backend',
                'status': 'completed',
                'completed_at': NOW - 2 * 86400,
                'milestone_id': 'm-chat-1'
            },
            {
                'id': 't-chat-2',
                'title': 'Design responsive workshop registration cards',
                'assigned_to': 'priyas',
                'responsibility': 'Frontend',
                'status': 'completed',
                'completed_at': NOW - 4 * 86400,
                'milestone_id': 'm-chat-1'
            },
            {
                'id': 't-chat-3',
                'title': 'Implement live workshop leaderboard',
                'assigned_to': 'naveen3438',
                'responsibility': 'Fullstack',
                'status': 'open',
                'milestone_id': 'm-chat-1'
            }
        ],
        'files': {
            'main': [
                {
                    'path': 'manage.py',
                    'name': 'manage.py',
                    'type': 'file',
                    'size': 820,
                    'updated_at': NOW - 5 * 86400,
                    'last_commit': 'Initial project setup',
                    'last_actor': 'naveen3438',
                    'content': '#!/usr/bin/env python\nimport os, sys\n'
                },
                {
                    'path': 'events/views.py',
                    'name': 'views.py',
                    'type': 'file',
                    'size': 2150,
                    'updated_at': NOW - 2 * 86400,
                    'last_commit': 'Pushed 4 commits to main: Added registration endpoint with QR code verification.',
                    'last_actor': 'naveen3438',
                    'content': '# Chaturya Event Registration Views\n'
                },
                {
                    'path': 'README.md',
                    'name': 'README.md',
                    'type': 'file',
                    'size': 980,
                    'updated_at': NOW - 2 * 86400,
                    'last_commit': 'Update project setup documentation',
                    'last_actor': 'naveen3438',
                    'content': '# chaturyanew\nStudent developers club platform for workshops, hackathons, and event registration.\n'
                }
            ],
            'develop': []
        },
        'attachments': [],
        'audit_log': []
    },
    'college-portal': {
        'id': 'repo-college',
        'name': 'college-portal',
        'owner': 'naveen3438',
        'description': 'Multi-tenant college portal for student records, admissions, and academic schedules.',
        'language': 'Python',
        'languageColor': '#3572A5',
        'visibility': 'Private',
        'defaultBranch': 'main',
        'created_at': NOW - 60 * 86400,
        'updated_at': NOW - 7 * 86400,
        'stars': 15,
        'forks': 4,
        'branches': ['main'],
        'members': [
            {
                'username': 'naveen3438',
                'role': 'Owner',
                'responsibility': 'Fullstack & Architecture',
                'assignedTasks': ['Admissions intake module'],
                'joined_at': NOW - 60 * 86400
            }
        ],
        'milestones': [],
        'tasks': [],
        'files': {
            'main': [
                {
                    'path': 'README.md',
                    'name': 'README.md',
                    'type': 'file',
                    'size': 640,
                    'updated_at': NOW - 7 * 86400,
                    'last_commit': 'Initial documentation',
                    'last_actor': 'naveen3438',
                    'content': '# College Portal\nMulti-tenant admissions and grading system.\n'
                }
            ]
        },
        'attachments': [],
        'audit_log': []
    },
    'portfolio-site': {
        'id': 'repo-portfolio',
        'name': 'portfolio-site',
        'owner': 'naveen3438',
        'description': 'Personal developer portfolio website with responsive UI and project showcases.',
        'language': 'JavaScript',
        'languageColor': '#F59E0B',
        'visibility': 'Public',
        'defaultBranch': 'main',
        'created_at': NOW - 90 * 86400,
        'updated_at': NOW - 21 * 86400,
        'stars': 12,
        'forks': 3,
        'branches': ['main'],
        'members': [
            {
                'username': 'naveen3438',
                'role': 'Owner',
                'responsibility': 'Design & Frontend',
                'assignedTasks': ['Dark mode toggle'],
                'joined_at': NOW - 90 * 86400
            }
        ],
        'milestones': [],
        'tasks': [],
        'files': {
            'main': [
                {
                    'path': 'index.html',
                    'name': 'index.html',
                    'type': 'file',
                    'size': 1840,
                    'updated_at': NOW - 21 * 86400,
                    'last_commit': 'Portfolio layout refresh',
                    'last_actor': 'naveen3438',
                    'content': '<!DOCTYPE html><html><head><title>Portfolio</title></head><body><h1>Naveen Kumar D</h1></body></html>'
                }
            ]
        },
        'attachments': [],
        'audit_log': []
    }
}

# --------------------------------------------------------------------------
# Initial Activity Events Dataset
# --------------------------------------------------------------------------
INITIAL_ACTIVITY_EVENTS = [
    {
        'id': 'evt_001',
        'type': 'file_uploaded',
        'actor': 'naveen3438',
        'actor_name': 'Naveen Kumar D',
        'actor_avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'develop',
        'title': 'Uploaded apps/pulse/engine.py to develop',
        'description': 'Added time-series aggregation buckets for Project Pulse real-time graph.',
        'timestamp': NOW - 900,
        'visibility': 'Private',
        'metadata': {'file_path': 'apps/pulse/engine.py', 'size': 2840}
    },
    {
        'id': 'evt_002',
        'type': 'git_commit',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Commit e4f912a: Refactor API endpoints and serializers',
        'description': 'Cleaned up DRF serializer interfaces and added PBKDF2 hash auto-upgrading.',
        'timestamp': NOW - 7200,
        'visibility': 'Private',
        'metadata': {'commit_hash': 'e4f912a'}
    },
    {
        'id': 'evt_003',
        'type': 'task_completed',
        'actor': 'naveen3438',
        'actor_name': 'Naveen Kumar D',
        'actor_avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'develop',
        'title': 'Completed task: Implement branch-aware file uploads with checksum verification',
        'description': 'Tested SHA-256 verification and directory traversal protection.',
        'timestamp': NOW - 28000,
        'visibility': 'Private',
        'metadata': {'task_id': 't-1'}
    },
    {
        'id': 'evt_004',
        'type': 'branch_created',
        'actor': 'naveen3438',
        'actor_name': 'Naveen Kumar D',
        'actor_avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'feature/authentication',
        'title': 'Created branch feature/authentication from develop',
        'description': 'Dedicated branch for single-use email OTP verification token flow.',
        'timestamp': NOW - 86400,
        'visibility': 'Private',
        'metadata': {'from_branch': 'develop'}
    },
    {
        'id': 'evt_005',
        'type': 'git_commit',
        'actor': 'naveen3438',
        'actor_name': 'Naveen Kumar D',
        'actor_avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'repository': 'chaturyanew',
        'branch': 'main',
        'title': 'Commit c98b14a: Added registration endpoint with QR code verification',
        'description': 'Student event registration backend module and email dispatcher.',
        'timestamp': NOW - 2 * 86400,
        'visibility': 'Public',
        'metadata': {'commit_hash': 'c98b14a'}
    },
    {
        'id': 'evt_006',
        'type': 'task_completed',
        'actor': 'priyas',
        'actor_name': 'Priya S',
        'actor_avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Completed task: Implement repository vertical navigation sidebar with drawer mode',
        'description': 'Responsive 220px desktop sidebar with touch drawer on mobile.',
        'timestamp': NOW - 3 * 86400,
        'visibility': 'Private',
        'metadata': {'task_id': 't-3'}
    },
    {
        'id': 'evt_007',
        'type': 'milestone_completed',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Milestone Completed: v0.9 MVP Infrastructure',
        'description': 'Achieved 100% completion across data models and auth security.',
        'timestamp': NOW - 4 * 86400,
        'visibility': 'Private',
        'metadata': {'milestone_id': 'm-2'}
    },
    {
        'id': 'evt_008',
        'type': 'collaborator_added',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Added collaborator @naveen3438 as Maintainer',
        'description': 'Assigned Fullstack & API Integration responsibilities.',
        'timestamp': NOW - 5 * 86400,
        'visibility': 'Private',
        'metadata': {'collaborator': 'naveen3438', 'role': 'Maintainer'}
    },
    {
        'id': 'evt_009',
        'type': 'issue_resolved',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Resolved Issue #14: Fix token authentication header parsing',
        'description': 'Handled Bearer token case-insensitively and supported cookie sessions.',
        'timestamp': NOW - 7 * 86400,
        'visibility': 'Private',
        'metadata': {'issue_number': 14}
    },
    {
        'id': 'evt_010',
        'type': 'pull_request_merged',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Merged PR #8: Universal developer profile model & API',
        'description': 'Integrated skills, projects, and bio persistence in devsync_database.json.',
        'timestamp': NOW - 12 * 86400,
        'visibility': 'Private',
        'metadata': {'pr_number': 8}
    },
    {
        'id': 'evt_011',
        'type': 'git_commit',
        'actor': 'naveen3438',
        'actor_name': 'Naveen Kumar D',
        'actor_avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'repository': 'chaturyanew',
        'branch': 'main',
        'title': 'Commit a12f890: Initialize Django app templates for student registrations',
        'description': 'Added responsive Tailwind and Bootstrap views for club signups.',
        'timestamp': NOW - 18 * 86400,
        'visibility': 'Public',
        'metadata': {'commit_hash': 'a12f890'}
    },
    {
        'id': 'evt_012',
        'type': 'repository_created',
        'actor': 'balajikumar',
        'actor_name': 'Balaji',
        'actor_avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'repository': 'devsync-core',
        'branch': 'main',
        'title': 'Created repository devsync-core',
        'description': 'Initialized repository with main branch and README.',
        'timestamp': NOW - 25 * 86400,
        'visibility': 'Private',
        'metadata': {'default_branch': 'main'}
    }
]

REPOSITORIES = dict(INITIAL_REPOSITORIES)
ACTIVITY_EVENTS = list(INITIAL_ACTIVITY_EVENTS)

# --------------------------------------------------------------------------
# Permissions & Helper Functions
# --------------------------------------------------------------------------

def get_repository_by_id_or_name(repo_identifier):
    """Lookup repository by ID (e.g. repo-devsync) or name (e.g. devsync-core)."""
    if not repo_identifier:
        return None
    ident = str(repo_identifier).strip().lower()
    if ident in REPOSITORIES:
        return REPOSITORIES[ident]
    for r in REPOSITORIES.values():
        if r.get('id', '').lower() == ident or r.get('name', '').lower() == ident:
            return r
    return None

def check_repo_permissions(user, repo):
    """
    Enforce strict role-based access control.
    Roles:
      - Owner: full control (invite, delete repo, change roles, remove members, upload files)
      - Maintainer: management (invite, change roles for Collaborators/Viewers, remove non-owners, upload files, create branches)
      - Collaborator: write access (upload files to branch, create branches, update tasks)
      - Viewer: read-only access
    Returns: (can_view, role, is_owner, is_maintainer, is_collaborator)
    """
    if not repo:
        return False, None, False, False, False

    username = user['username'].lower() if user and isinstance(user, dict) and 'username' in user else None
    owner = repo.get('owner', '').lower()
    is_owner = (username == owner) if username else False

    member_role = None
    for m in repo.get('members', []):
        if m.get('username', '').lower() == username:
            member_role = m.get('role', 'Collaborator')
            break

    if is_owner:
        member_role = 'Owner'

    is_maintainer = is_owner or (member_role == 'Maintainer')
    is_collaborator = is_maintainer or (member_role == 'Collaborator')
    can_view = (repo.get('visibility') == 'Public') or (member_role is not None)

    return can_view, member_role, is_owner, is_maintainer, is_collaborator

def sanitize_file_path(path_str):
    """
    Validate and sanitize repository file path.
    Prevents path traversal, absolute paths, null bytes.
    Returns: (cleaned_path, error_message)
    """
    if not path_str or not isinstance(path_str, str):
        return None, "File path cannot be empty."

    clean = path_str.strip().replace('\\', '/')
    clean = clean.lstrip('/')

    if '\0' in clean:
        return None, "Invalid file path (null byte detected)."

    parts = clean.split('/')
    for p in parts:
        if p in ('..', '.', ''):
            return None, "Path traversal sequence '..' or '.' is forbidden."
        if not re.match(r'^[a-zA-Z0-9_\-\.\+ ]+$', p):
            return None, f"Path segment '{p}' contains invalid characters."

    if len(clean) > 256:
        return None, "File path exceeds maximum length of 256 characters."

    return clean, None

def record_activity_event(event_type, actor_username, repo_identifier, branch=None, title="", description="", metadata=None, visibility=None, dev_profiles=None):
    """Record genuine activity event with deduplication and timestamps."""
    global ACTIVITY_EVENTS
    now = time.time()

    actor_name = actor_username
    actor_avatar = ''
    if dev_profiles and actor_username.lower() in dev_profiles:
        p = dev_profiles[actor_username.lower()]
        actor_name = p.get('name', actor_username)
        actor_avatar = p.get('avatar', '')

    repo = get_repository_by_id_or_name(repo_identifier)
    repo_name = repo.get('name', repo_identifier) if repo else repo_identifier
    if visibility is None and repo:
        visibility = repo.get('visibility', 'Public')
    elif visibility is None:
        visibility = 'Public'

    evt_id = f"evt_{secrets.token_hex(6)}"
    dedup_key = f"{event_type}:{actor_username}:{repo_name}:{branch}:{title}:{int(now / 60)}"
    dedup_hash = hashlib.sha256(dedup_key.encode('utf-8')).hexdigest()

    for existing in ACTIVITY_EVENTS[:20]:
        if existing.get('dedup_hash') == dedup_hash:
            return existing

    evt = {
        'id': evt_id,
        'type': event_type,
        'actor': actor_username,
        'actor_name': actor_name,
        'actor_avatar': actor_avatar,
        'repository': repo_name,
        'branch': branch,
        'title': title or f"{event_type} in {repo_name}",
        'description': description or '',
        'timestamp': now,
        'visibility': visibility,
        'metadata': metadata or {},
        'dedup_hash': dedup_hash
    }
    ACTIVITY_EVENTS.insert(0, evt)
    return evt

# --------------------------------------------------------------------------
# Project Pulse Aggregation & Analytics
# --------------------------------------------------------------------------

def aggregate_pulse(username, range_type='7d', project_filter='all', caller_username=None):
    """
    Aggregate genuine activity events into uniform time-series buckets.
    Enforces privacy: private repository events are only visible to authorized members.
    """
    now = time.time()
    range_type = (range_type or '7d').lower()

    if range_type == 'live':
        window_seconds = 1800  # 30 mins
        num_buckets = 6
        bucket_seconds = 300  # 5 mins
        fmt = "%H:%M"
    elif range_type == '24h':
        window_seconds = 86400  # 24 hours
        num_buckets = 12
        bucket_seconds = 7200  # 2 hours
        fmt = "%H:00"
    elif range_type == '30d':
        window_seconds = 30 * 86400
        num_buckets = 15
        bucket_seconds = 2 * 86400  # 2 days
        fmt = "%b %d"
    else:  # default '7d'
        range_type = '7d'
        window_seconds = 7 * 86400
        num_buckets = 7
        bucket_seconds = 86400  # 1 day
        fmt = "%a %d"

    start_time = now - window_seconds

    # Find repositories where username is owner or member
    user_repos = set()
    for r in REPOSITORIES.values():
        if r.get('owner', '').lower() == username.lower() or any(m.get('username', '').lower() == username.lower() for m in r.get('members', [])):
            user_repos.add(r['name'].lower())

    filtered_events = []
    for evt in ACTIVITY_EVENTS:
        evt_time = evt.get('timestamp', 0)
        if evt_time < start_time or evt_time > now:
            continue

        repo_name = evt.get('repository', '').lower()
        if project_filter and project_filter.lower() != 'all':
            if repo_name != project_filter.lower():
                continue

        is_actor = (evt.get('actor', '').lower() == username.lower())
        is_user_repo = (repo_name in user_repos)
        if not (is_actor or is_user_repo):
            continue

        # Privacy gate
        if evt.get('visibility') == 'Private':
            if not caller_username:
                continue
            is_caller_authorized = False
            repo_obj = get_repository_by_id_or_name(repo_name)
            if repo_obj:
                _, _, is_owner, is_maint, is_collab = check_repo_permissions({'username': caller_username}, repo_obj)
                is_caller_authorized = is_collab
            if not is_caller_authorized and caller_username.lower() != evt.get('actor', '').lower():
                continue

        filtered_events.append(evt)

    buckets = []
    for i in range(num_buckets):
        b_start = start_time + i * bucket_seconds
        b_end = b_start + bucket_seconds
        dt = datetime.datetime.fromtimestamp(b_start, datetime.timezone.utc)
        label = dt.strftime(fmt)

        bucket_evts = [e for e in filtered_events if b_start <= e['timestamp'] < b_end]
        commits_cnt = sum(1 for e in bucket_evts if e['type'] == 'git_commit')
        uploads_cnt = sum(1 for e in bucket_evts if e['type'] == 'file_uploaded')
        tasks_cnt = sum(1 for e in bucket_evts if e['type'] in ('task_completed', 'task_created'))
        branches_cnt = sum(1 for e in bucket_evts if e['type'] == 'branch_created')
        milestones_cnt = sum(1 for e in bucket_evts if e['type'] == 'milestone_completed')

        buckets.append({
            'timestamp': b_start,
            'label': label,
            'count': len(bucket_evts),
            'commits': commits_cnt,
            'uploads': uploads_cnt,
            'tasks': tasks_cnt,
            'branches': branches_cnt,
            'milestones': milestones_cnt,
            'eventIds': [e['id'] for e in bucket_evts]
        })

    total_events = len(filtered_events)
    latest_ts = max((e['timestamp'] for e in filtered_events), default=now)

    # Calculate trend vs prior interval
    prior_start = start_time - window_seconds
    prior_evts = [e for e in ACTIVITY_EVENTS if prior_start <= e.get('timestamp', 0) < start_time]
    if prior_evts:
        diff = ((total_events - len(prior_evts)) / len(prior_evts)) * 100
        trend_str = f"{'+' if diff >= 0 else ''}{int(diff)}%"
    else:
        trend_str = "+100%" if total_events > 0 else "0%"

    return {
        'username': username,
        'range': range_type,
        'totalEvents': total_events,
        'latestActivity': latest_ts,
        'trend': trend_str,
        'points': buckets,
        'projects': sorted(list(user_repos)),
        'liveStatus': 'active'
    }

def get_pulse_events(username, range_type='7d', project_filter='all', caller_username=None, event_ids=None):
    """Retrieve detailed event records for a selected point or time window."""
    pulse_summary = aggregate_pulse(username, range_type, project_filter, caller_username)
    allowed_ids = set()
    for pt in pulse_summary['points']:
        for eid in pt['eventIds']:
            allowed_ids.add(eid)

    target_ids = set(event_ids) if event_ids else allowed_ids
    results = [e for e in ACTIVITY_EVENTS if e['id'] in target_ids and e['id'] in allowed_ids]
    results.sort(key=lambda x: x['timestamp'], reverse=True)
    return results

def get_pulse_comparison(username, range_type='7d', caller_username=None):
    """Compare verified activity across the user's projects over a selected range."""
    now = time.time()
    days = 30 if range_type == '30d' else 7
    start_time = now - (days * 86400)

    # Gather projects
    user_repos = []
    for r in REPOSITORIES.values():
        if r.get('owner', '').lower() == username.lower() or any(m.get('username', '').lower() == username.lower() for m in r.get('members', [])):
            can_view, _, _, _, _ = check_repo_permissions({'username': caller_username} if caller_username else None, r)
            if can_view:
                user_repos.append(r)

    comparison = []
    for r in user_repos:
        repo_name = r['name']
        evts = [e for e in ACTIVITY_EVENTS if e.get('repository', '').lower() == repo_name.lower() and start_time <= e.get('timestamp', 0) <= now]
        commits_cnt = sum(1 for e in evts if e['type'] == 'git_commit')
        uploads_cnt = sum(1 for e in evts if e['type'] == 'file_uploaded')
        tasks_cnt = sum(1 for e in evts if e['type'] in ('task_completed', 'task_created'))

        comparison.append({
            'repository': repo_name,
            'visibility': r.get('visibility', 'Public'),
            'language': r.get('language', 'Unknown'),
            'languageColor': r.get('languageColor', '#3572A5'),
            'totalEvents': len(evts),
            'commits': commits_cnt,
            'uploads': uploads_cnt,
            'tasks': tasks_cnt,
            'stars': r.get('stars', 0),
            'forks': r.get('forks', 0)
        })

    comparison.sort(key=lambda x: x['totalEvents'], reverse=True)
    return {
        'username': username,
        'range': f"{days}d",
        'projects': comparison
    }

def get_pulse_progress(username, project_identifier=None, caller_username=None):
    """Retrieve actual task and milestone progress over time (never inferred from raw commits)."""
    target_repo = None
    if project_identifier:
        target_repo = get_repository_by_id_or_name(project_identifier)

    if not target_repo:
        # Pick primary repository
        for r in REPOSITORIES.values():
            if r.get('owner', '').lower() == username.lower() or any(m.get('username', '').lower() == username.lower() for m in r.get('members', [])):
                target_repo = r
                break

    if not target_repo:
        return {'error': 'No repositories found for progress tracking.'}

    can_view, _, _, _, _ = check_repo_permissions({'username': caller_username} if caller_username else None, target_repo)
    if not can_view:
        return {'error': 'Forbidden: You do not have permission to view progress for this private project.'}

    milestones = target_repo.get('milestones', [])
    tasks = target_repo.get('tasks', [])
    completed_tasks = [t for t in tasks if t.get('status') == 'completed']

    return {
        'repository': target_repo['name'],
        'milestones': milestones,
        'totalTasks': len(tasks),
        'completedTasksCount': len(completed_tasks),
        'openTasksCount': len(tasks) - len(completed_tasks),
        'completionRate': round((len(completed_tasks) / len(tasks) * 100)) if tasks else 0,
        'completedTasks': completed_tasks,
        'openTasks': [t for t in tasks if t.get('status') != 'completed']
    }

def get_pulse_team_contributions(project_identifier, caller_username=None):
    """Breakdown recorded genuine contributions by team member for a repository."""
    repo = get_repository_by_id_or_name(project_identifier)
    if not repo:
        return {'error': 'Repository not found'}

    can_view, _, _, _, _ = check_repo_permissions({'username': caller_username} if caller_username else None, repo)
    if not can_view:
        return {'error': 'Forbidden: You do not have permission to view team contributions for this private repository.'}

    members = repo.get('members', [])
    repo_name = repo['name']

    team_stats = []
    for m in members:
        u = m.get('username', '')
        evts = [e for e in ACTIVITY_EVENTS if e.get('repository', '').lower() == repo_name.lower() and e.get('actor', '').lower() == u.lower()]
        commits_cnt = sum(1 for e in evts if e['type'] == 'git_commit')
        uploads_cnt = sum(1 for e in evts if e['type'] == 'file_uploaded')
        tasks_cnt = sum(1 for e in evts if e['type'] in ('task_completed', 'task_created'))

        team_stats.append({
            'username': u,
            'role': m.get('role', 'Collaborator'),
            'responsibility': m.get('responsibility', 'Contributor'),
            'assignedTasks': m.get('assignedTasks', []),
            'totalRecordedActions': len(evts),
            'commits': commits_cnt,
            'fileUploads': uploads_cnt,
            'tasksCompleted': tasks_cnt
        })

    team_stats.sort(key=lambda x: x['totalRecordedActions'], reverse=True)
    return {
        'repository': repo_name,
        'membersCount': len(members),
        'contributions': team_stats
    }

# --------------------------------------------------------------------------
# Branch-Aware File Uploads & Project Attachments
# --------------------------------------------------------------------------

def handle_branch_file_upload(repo, branch, file_path, content, commit_message, actor_username, overwrite=False, base_data_dir='data'):
    """
    Execute a branch-aware repository file upload.
    - Validates path against traversal
    - Verifies branch existence
    - Enforces conflict / overwrite protection
    - Persists file to branch directory: data/repositories/<repo>/branches/<branch>/<path>
    - Updates file tree, audit log, and records activity event
    """
    clean_path, err = sanitize_file_path(file_path)
    if err:
        return False, {'error': 'Invalid path', 'detail': err}, 400

    if branch not in repo.get('branches', []):
        return False, {'error': 'Branch not found', 'detail': f"Branch '{branch}' does not exist on this repository."}, 400

    if not isinstance(content, (str, bytes)):
        return False, {'error': 'Invalid content', 'detail': 'File content must be text or bytes.'}, 400

    if isinstance(content, str):
        content_bytes = content.encode('utf-8')
    else:
        content_bytes = content

    if len(content_bytes) > 10 * 1024 * 1024:
        return False, {'error': 'File too large', 'detail': 'Uploaded file exceeds the 10 MB limit.'}, 400

    repo_files = repo.setdefault('files', {})
    branch_files = repo_files.setdefault(branch, [])

    existing_idx = None
    for idx, f in enumerate(branch_files):
        if f.get('path') == clean_path:
            existing_idx = idx
            break

    if existing_idx is not None and not overwrite:
        return False, {
            'error': 'File conflict',
            'detail': f"A file already exists at '{clean_path}' on branch '{branch}'. Confirm overwrite to replace.",
            'requiresConfirmation': True,
            'branch': branch,
            'filePath': clean_path,
            'existingFileSize': branch_files[existing_idx].get('size', 0),
            'existingFileUpdated': branch_files[existing_idx].get('updated_at', 0)
        }, 409

    sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    # Write file physically to branch-specific disk location
    disk_path = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', branch, clean_path.replace('/', os.sep))
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, 'wb') as f:
        f.write(content_bytes)

    now = time.time()
    summary = commit_message.strip() if commit_message else f"Upload {clean_path} to {branch}"
    file_entry = {
        'path': clean_path,
        'name': os.path.basename(clean_path),
        'type': 'file',
        'size': len(content_bytes),
        'updated_at': now,
        'last_commit': summary,
        'last_actor': actor_username,
        'sha256': sha256_hash,
        'content': content if isinstance(content, str) else content_bytes.decode('utf-8', errors='ignore')
    }

    if existing_idx is not None:
        branch_files[existing_idx] = file_entry
    else:
        branch_files.append(file_entry)

    repo['updated_at'] = now

    audit_entry = {
        'id': f"aud_{secrets.token_hex(6)}",
        'action': 'file_overwrite' if existing_idx is not None else 'file_upload',
        'branch': branch,
        'file_path': clean_path,
        'actor': actor_username,
        'timestamp': now,
        'summary': summary,
        'sha256': sha256_hash,
        'size': len(content_bytes)
    }
    repo.setdefault('audit_log', []).insert(0, audit_entry)

    record_activity_event(
        'file_uploaded',
        actor_username,
        repo['name'],
        branch=branch,
        title=f"Uploaded {clean_path} to {branch}",
        description=summary,
        metadata={'file_path': clean_path, 'sha256': sha256_hash, 'size': len(content_bytes)},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'message': f"File '{clean_path}' successfully committed to branch '{branch}'.",
        'file': {
            'path': clean_path,
            'name': file_entry['name'],
            'branch': branch,
            'size': len(content_bytes),
            'sha256': sha256_hash,
            'lastCommit': summary,
            'lastActor': actor_username,
            'updatedAt': now
        },
        'auditId': audit_entry['id']
    }, 200 if existing_idx is not None else 201

def handle_attachment_upload(repo, file_name, content, file_type, description, actor_username, base_data_dir='data'):
    """
    Store supporting project attachments (PDFs, mockups, design specifications).
    Clearly segregated from Git branch files.
    """
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\. ]', '', os.path.basename(file_name)) or f"attachment_{int(time.time())}"
    if isinstance(content, str):
        content_bytes = content.encode('utf-8')
    else:
        content_bytes = content

    if len(content_bytes) > 25 * 1024 * 1024:
        return False, {'error': 'Attachment too large', 'detail': 'Attachments cannot exceed 25 MB.'}, 400

    att_id = f"att_{secrets.token_hex(6)}"
    disk_path = os.path.join(base_data_dir, 'repositories', repo['name'], 'attachments', f"{att_id}_{clean_name}")
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, 'wb') as f:
        f.write(content_bytes)

    now = time.time()
    att_entry = {
        'id': att_id,
        'name': clean_name,
        'size': len(content_bytes),
        'uploaded_by': actor_username,
        'uploaded_at': now,
        'file_type': file_type or 'application/octet-stream',
        'description': description or 'Supporting project attachment'
    }
    repo.setdefault('attachments', []).insert(0, att_entry)
    repo['updated_at'] = now

    record_activity_event(
        'attachment_uploaded',
        actor_username,
        repo['name'],
        title=f"Uploaded project attachment: {clean_name}",
        description=description or 'Added supporting documentation',
        metadata={'attachment_id': att_id, 'file_name': clean_name, 'size': len(content_bytes)},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'message': f"Attachment '{clean_name}' uploaded successfully.",
        'attachment': att_entry
    }, 201
