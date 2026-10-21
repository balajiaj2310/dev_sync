from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from apps.accounts.models import User, Profile, Skill, Education, Experience, Achievement, Connection
from apps.repositories.models import Repository, Branch, Commit, FileBlob, Collaborator
from apps.pulls.models import PullRequest, PRReview, PRComment
from apps.issues.models import Issue, IssueComment, Label
from apps.teams.models import Team, Membership, Invitation
from apps.notifications.models import Notification, NotificationPreference
from apps.analytics.models import ActivityEvent
from apps.chat.models import Conversation, Participant, Message, Reaction, StatusUpdate

DEMO_USERS = [
    {
        'username': 'naveen3438',
        'email': 'naveen@devsync.dev',
        'password': 'demo12345',
        'name': 'Naveen Kumar D',
        'role': 'Developer',
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
        'education': [
            {
                'degree': 'BCA Student',
                'institution': 'Bengaluru City University',
                'location': 'Bengaluru, India',
                'field': 'Computer Applications',
                'start_year': 2022,
                'end_year': 2025
            }
        ],
        'experience': [
            {
                'title': 'Full Stack Intern',
                'company': 'Chaturya Tech Club',
                'location': 'Bengaluru, India',
                'start_date': '2023-01-01',
                'is_current': True,
                'description': 'Building event registration portals and student developer community platforms with Django.'
            }
        ],
        'skills': [
            ('Python', 'Backend', 'advanced', 'blue'),
            ('Django', 'Backend', 'advanced', 'mint'),
            ('Flask', 'Backend', 'intermediate', 'blue'),
            ('Java', 'Backend', 'intermediate', 'blue'),
            ('JavaScript', 'Frontend', 'advanced', 'amber'),
            ('HTML', 'Frontend', 'expert', 'rose'),
            ('CSS', 'Frontend', 'advanced', 'purple'),
            ('MySQL', 'Database', 'intermediate', 'cyan'),
            ('Git', 'DevOps', 'advanced', 'neutral'),
            ('GitHub', 'DevOps', 'advanced', 'neutral'),
            ('Bootstrap', 'Frontend', 'advanced', 'purple'),
            ('SQL', 'Database', 'advanced', 'cyan')
        ],
        'achievements': [
            ('First Project', 'Created your first public project', 'green', 'badge'),
            ('Collaborator', 'Worked with 5+ developers', 'blue', 'award'),
            ('Consistent', 'Active for 30+ days', 'purple', 'milestone')
        ]
    },
    {
        'username': 'balajikumar',
        'email': 'balaji@devsync.dev',
        'password': 'demo12345',
        'name': 'Balaji Kumar',
        'role': 'Core Contributor',
        'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'headline': 'Fullstack engineer & open-source contributor.',
        'bio': 'Fullstack engineer & open-source contributor. Building high-performance developer tools and collaboration systems.',
        'location': 'Chennai, India',
        'website': 'https://balajikumar.dev',
        'social': {
            'github': 'https://github.com/balajikumar',
            'linkedin': 'https://linkedin.com/in/balajikumar'
        },
        'collaborationStatus': 'Open to project invitations',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'education': [],
        'experience': [],
        'skills': [
            ('Python', 'Backend', 'advanced', 'blue'),
            ('Django', 'Backend', 'advanced', 'mint'),
            ('JavaScript', 'Frontend', 'advanced', 'amber'),
            ('PostgreSQL', 'Database', 'advanced', 'cyan'),
            ('Docker', 'DevOps', 'intermediate', 'neutral')
        ],
        'achievements': []
    },
    {
        'username': 'ananyaroy',
        'email': 'ananya@devsync.dev',
        'password': 'demo12345',
        'name': 'Ananya Roy',
        'role': 'Cloud Engineer',
        'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
        'headline': 'Building high-performance cloud microservices and open source developer utilities.',
        'bio': 'Fullstack engineer passionate about cloud microservices and scalable web applications.',
        'location': 'Hyderabad, India',
        'website': 'https://ananyaroy.dev',
        'social': {'github': 'https://github.com/ananyaroy'},
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'education': [],
        'experience': [],
        'skills': [
            ('Python', 'Backend', 'advanced', 'blue'),
            ('React', 'Frontend', 'advanced', 'cyan'),
            ('PostgreSQL', 'Database', 'advanced', 'cyan'),
            ('Docker', 'DevOps', 'advanced', 'neutral')
        ],
        'achievements': []
    },
    {
        'username': 'vikramrao',
        'email': 'vikram@devsync.dev',
        'password': 'demo12345',
        'name': 'Vikram Rao',
        'role': 'ML Engineer',
        'avatar': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
        'headline': 'Machine Learning specialist, working with PyTorch, model deployment, and FastAPI.',
        'bio': 'Machine Learning specialist focused on large-scale model inference, edge deployment, and PyTorch tooling.',
        'location': 'Pune, India',
        'website': 'https://vikramrao.ai',
        'social': {'github': 'https://github.com/vikramrao'},
        'collaborationStatus': 'Open to project invitations',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'education': [],
        'experience': [],
        'skills': [
            ('PyTorch', 'Backend', 'advanced', 'rose'),
            ('FastAPI', 'Backend', 'advanced', 'mint'),
            ('Python', 'Backend', 'advanced', 'blue'),
            ('Docker', 'DevOps', 'advanced', 'neutral')
        ],
        'achievements': []
    },
    {
        'username': 'tarapatel',
        'email': 'tara@devsync.dev',
        'password': 'demo12345',
        'name': 'Tara Patel',
        'role': 'DevOps Specialist',
        'avatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
        'headline': 'DevOps & Site Reliability Engineer focused on Kubernetes orchestration and Terraform.',
        'bio': 'SRE and cloud infrastructure developer with a passion for automated CI/CD pipelines and zero-downtime deployments.',
        'location': 'Mumbai, India',
        'website': 'https://tarapatel.cloud',
        'social': {'github': 'https://github.com/tarapatel'},
        'collaborationStatus': 'Available for collaboration',
        'collaborationStatusType': 'available',
        'openToInvitations': True,
        'education': [],
        'experience': [],
        'skills': [
            ('Kubernetes', 'DevOps', 'expert', 'cyan'),
            ('Terraform', 'DevOps', 'advanced', 'purple'),
            ('Go', 'Backend', 'intermediate', 'blue'),
            ('AWS', 'DevOps', 'advanced', 'amber')
        ],
        'achievements': []
    },
    {
        'username': 'rahuldev',
        'email': 'rahul@devsync.dev',
        'password': 'demo12345',
        'name': 'Rahul Dev',
        'role': 'Frontend Architect',
        'avatar': 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&q=80',
        'headline': 'Frontend enthusiast crafting accessible design systems and lightning-fast web experiences.',
        'bio': 'Frontend specialist obsessed with component performance, design token architectures, and accessibility standards.',
        'location': 'Delhi, India',
        'website': 'https://rahuldev.design',
        'social': {'github': 'https://github.com/rahuldev'},
        'collaborationStatus': 'Currently busy',
        'collaborationStatusType': 'busy',
        'openToInvitations': False,
        'education': [],
        'experience': [],
        'skills': [
            ('TypeScript', 'Frontend', 'expert', 'blue'),
            ('Vue', 'Frontend', 'advanced', 'mint'),
            ('React', 'Frontend', 'expert', 'cyan')
        ],
        'achievements': []
    }
]

class Command(BaseCommand):
    help = 'Seed demo users and profiles for DevSync platform'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting demo data seeding..."))

        created_users = {}

        with transaction.atomic():
            for data in DEMO_USERS:
                username = data['username']
                email = data['email']
                password = data['password']

                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': email,
                        'is_email_verified': True,
                        'is_active': True
                    }
                )
                user.set_password(password)
                user.save()
                created_users[username] = user

                profile, _ = Profile.objects.get_or_create(user=user)
                profile.display_name = data['name']
                profile.role = data['role']
                profile.headline = data['headline']
                profile.bio = data['bio']
                profile.location = data['location']
                profile.website = data['website']
                profile.avatar = data['avatar']
                profile.social_links = data['social']
                profile.collaboration_status = data['collaborationStatus']
                profile.collaboration_status_type = data['collaborationStatusType']
                profile.open_to_invitations = data['openToInvitations']
                profile.save()

                # Skills
                for sk_name, sk_cat, sk_prof, sk_color in data.get('skills', []):
                    Skill.objects.update_or_create(
                        user=user,
                        name=sk_name,
                        defaults={
                            'level': sk_prof
                        }
                    )

                # Achievements
                for ach_title, ach_desc, ach_color, ach_icon in data.get('achievements', []):
                    Achievement.objects.get_or_create(
                        user=user,
                        title=ach_title,
                        defaults={
                            'description': ach_desc,
                            'badge_icon': ach_icon
                        }
                    )

                # Education
                for edu in data.get('education', []):
                    Education.objects.get_or_create(
                        user=user,
                        institution=edu['institution'],
                        degree=edu['degree'],
                        defaults={
                            'field_of_study': edu['field'],
                            'start_year': edu['start_year'],
                            'end_year': edu['end_year']
                        }
                    )

                # Experience
                for exp in data.get('experience', []):
                    Experience.objects.get_or_create(
                        user=user,
                        title=exp['title'],
                        company=exp['company'],
                        defaults={
                            'location': exp['location'],
                            'start_date': exp['start_date'],
                            'is_current': exp['is_current'],
                            'description': exp['description']
                        }
                    )

                self.stdout.write(self.style.SUCCESS(f"Seeded user: {username}"))

            # Create demo connections
            if 'naveen3438' in created_users and 'balajikumar' in created_users:
                Connection.objects.get_or_create(
                    requester=created_users['naveen3438'],
                    recipient=created_users['balajikumar'],
                    defaults={'status': 'accepted'}
                )
            if 'naveen3438' in created_users and 'ananyaroy' in created_users:
                Connection.objects.get_or_create(
                    requester=created_users['ananyaroy'],
                    recipient=created_users['naveen3438'],
                    defaults={'status': 'accepted'}
                )
            if 'naveen3438' in created_users and 'vikramrao' in created_users:
                Connection.objects.get_or_create(
                    requester=created_users['naveen3438'],
                    recipient=created_users['vikramrao'],
                    defaults={'status': 'pending'}
                )

            # Seed demo repositories
            demo_repos = [
                {
                    'name': 'devsync-core',
                    'owner': created_users.get('balajikumar', created_users['naveen3438']),
                    'description': 'Main platform for developer collaboration with repositories, teams and discussions.',
                    'visibility': 'public',
                    'icon_bg': '#0D9488',
                    'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Django', 'color': 'mint'}]
                },
                {
                    'name': 'chaturyanew',
                    'owner': created_users['naveen3438'],
                    'description': 'Student developers club website built with Django. Event registrations, workshops and community features.',
                    'visibility': 'public',
                    'icon_bg': '#10B981',
                    'tags': [{'name': 'Python', 'color': 'blue'}, {'name': 'Django', 'color': 'mint'}]
                },
                {
                    'name': 'portfolio-site',
                    'owner': created_users['naveen3438'],
                    'description': 'Personal portfolio website with modern UI and responsive design.',
                    'visibility': 'public',
                    'icon_bg': '#1E293B',
                    'tags': [{'name': 'JavaScript', 'color': 'amber'}, {'name': 'CSS', 'color': 'purple'}]
                },
                {
                    'name': 'college-portal',
                    'owner': created_users['naveen3438'],
                    'description': 'Multi-tenant college website with admissions and student portal.',
                    'visibility': 'private',
                    'icon_bg': '#6366F1',
                    'tags': [{'name': 'Flask', 'color': 'blue'}]
                },
                {
                    'name': 'campus-connect',
                    'owner': created_users.get('ananyaroy', created_users['naveen3438']),
                    'description': 'Campus collaboration network for universities.',
                    'visibility': 'public',
                    'icon_bg': '#06B6D4',
                    'tags': [{'name': 'React', 'color': 'cyan'}]
                },
                {
                    'name': 'chaturya-club',
                    'owner': created_users['naveen3438'],
                    'description': 'Club event portals and student resources.',
                    'visibility': 'public',
                    'icon_bg': '#8B5CF6',
                    'tags': [{'name': 'Python', 'color': 'blue'}]
                }
            ]

            seeded_repos = {}
            for r_info in demo_repos:
                repo, _ = Repository.objects.get_or_create(
                    name=r_info['name'],
                    owner=r_info['owner'],
                    defaults={
                        'slug': slugify(r_info['name']),
                        'description': r_info['description'],
                        'visibility': r_info['visibility'],
                        'icon_bg': r_info['icon_bg'],
                        'tags': r_info['tags']
                    }
                )
                seeded_repos[r_info['name']] = repo

                # Ensure default branch
                main_br, _ = Branch.objects.get_or_create(repository=repo, name='main', defaults={'is_default': True})
                Branch.objects.get_or_create(repository=repo, name='develop')
                Branch.objects.get_or_create(repository=repo, name='feat/automated-test')

                # Collaborators
                for u in created_users.values():
                    if u != repo.owner:
                        Collaborator.objects.get_or_create(
                            repository=repo,
                            user=u,
                            defaults={'role': 'Contributor'}
                        )
                    else:
                        Collaborator.objects.get_or_create(
                            repository=repo,
                            user=u,
                            defaults={'role': 'Admin'}
                        )

                # Seed sample file
                FileBlob.objects.get_or_create(
                    repository=repo,
                    branch=main_br,
                    path='README.md',
                    defaults={
                        'content': f"# {repo.name}\n\n{repo.description}",
                        'size': len(repo.description.encode('utf-8')),
                        'mime_type': 'text/markdown'
                    }
                )

            # Seed demo Issues
            demo_issues = [
                {
                    'number': 104,
                    'title': 'Add dark mode support',
                    'repo': seeded_repos.get('portfolio-site', list(seeded_repos.values())[0]),
                    'author': created_users['naveen3438'],
                    'status': 'Open',
                    'desc': 'The user settings need an explicit theme selector.'
                },
                {
                    'number': 102,
                    'title': 'Fix file upload size limit',
                    'repo': seeded_repos.get('campus-connect', list(seeded_repos.values())[0]),
                    'author': created_users.get('balajikumar', created_users['naveen3438']),
                    'status': 'Open',
                    'desc': 'Files larger than 10MB trigger an unhandled 413 error.'
                },
                {
                    'number': 99,
                    'title': 'Add analytics dashboard',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users.get('ananyaroy', created_users['naveen3438']),
                    'status': 'Open',
                    'desc': 'Provide commit volume trends and team velocity heatmaps.'
                },
                {
                    'number': 95,
                    'title': 'Optimize query latency in chat consumers',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users['naveen3438'],
                    'status': 'Closed',
                    'desc': 'Cache conversation memberships in Redis.'
                },
                {
                    'number': 91,
                    'title': 'Implement RFC 6238 TOTP two-factor security',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users.get('vikramrao', created_users['naveen3438']),
                    'status': 'Closed',
                    'desc': 'Add TOTP device enrollment and emergency recovery codes.'
                }
            ]

            for iss_data in demo_issues:
                iss, _ = Issue.objects.get_or_create(
                    repository=iss_data['repo'],
                    number=iss_data['number'],
                    defaults={
                        'title': iss_data['title'],
                        'author': iss_data['author'],
                        'status': iss_data['status'],
                        'description': iss_data['desc']
                    }
                )
                IssueComment.objects.get_or_create(
                    issue=iss,
                    author=created_users['naveen3438'],
                    defaults={'text': 'Looking into this requirement.'}
                )

            # Seed demo Pull Requests
            demo_prs = [
                {
                    'number': 41,
                    'title': 'Fix navbar responsive issue on mobile',
                    'repo': seeded_repos.get('portfolio-site', list(seeded_repos.values())[0]),
                    'author': created_users['naveen3438'],
                    'source': 'fix/mobile-navbar',
                    'target': 'main',
                    'status': 'Open'
                },
                {
                    'number': 39,
                    'title': 'Improve database schema and add indexes',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users.get('balajikumar', created_users['naveen3438']),
                    'source': 'develop',
                    'target': 'main',
                    'status': 'Open'
                },
                {
                    'number': 38,
                    'title': 'Add image upload for gallery',
                    'repo': seeded_repos.get('chaturya-club', list(seeded_repos.values())[0]),
                    'author': created_users.get('ananyaroy', created_users['naveen3438']),
                    'source': 'feat/gallery-upload',
                    'target': 'main',
                    'status': 'Open'
                },
                {
                    'number': 37,
                    'title': 'Refactor user profile serialization security whitelist',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users['naveen3438'],
                    'source': 'security/profile-whitelist',
                    'target': 'main',
                    'status': 'Merged'
                },
                {
                    'number': 35,
                    'title': 'Implement Argon2 password hasher upgrade pipeline',
                    'repo': seeded_repos.get('devsync-core', list(seeded_repos.values())[0]),
                    'author': created_users.get('vikramrao', created_users['naveen3438']),
                    'source': 'security/argon2-upgrade',
                    'target': 'main',
                    'status': 'Merged'
                }
            ]

            for pr_data in demo_prs:
                PullRequest.objects.get_or_create(
                    repository=pr_data['repo'],
                    number=pr_data['number'],
                    defaults={
                        'title': pr_data['title'],
                        'author': pr_data['author'],
                        'source_branch': pr_data['source'],
                        'target_branch': pr_data['target'],
                        'status': pr_data['status'],
                        'changed_files': [{'path': 'src/core.ts', 'additions': 10, 'deletions': 2}],
                        'additions': 10,
                        'deletions': 2
                    }
                )

            # Seed demo Teams
            demo_teams = [
                ('DevSync Core Team', 'devsync-core', 'Engineers building the DevSync collaboration and productivity platform.'),
                ('Chaturya Developers', 'chaturya-devs', 'Student developers club and open-source project incubator.'),
                ('Cloud Infrastructure Squad', 'cloud-infra', 'Automating multi-cloud Kubernetes clusters and CI/CD pipelines.'),
                ('AI/ML Research Group', 'ai-ml-research', 'Fine-tuning foundation models and local edge inference pipelines.')
            ]
            seeded_teams = {}
            for t_name, t_slug, t_desc in demo_teams:
                team, _ = Team.objects.get_or_create(
                    slug=t_slug,
                    defaults={'name': t_name, 'description': t_desc, 'created_by': created_users['naveen3438']}
                )
                seeded_teams[t_slug] = team

            # Team memberships
            core_team = seeded_teams['devsync-core']
            Membership.objects.get_or_create(team=core_team, user=created_users['naveen3438'], defaults={'role': 'Lead Maintainer', 'project': 'devsync-core'})
            Membership.objects.get_or_create(team=core_team, user=created_users['balajikumar'], defaults={'role': 'Core Contributor', 'project': 'devsync-core'})
            Membership.objects.get_or_create(team=core_team, user=created_users['ananyaroy'], defaults={'role': 'Cloud Engineer', 'project': 'devsync-core'})
            Membership.objects.get_or_create(team=core_team, user=created_users['vikramrao'], defaults={'role': 'ML Engineer', 'project': 'devsync-core'})
            Membership.objects.get_or_create(team=core_team, user=created_users['tarapatel'], defaults={'role': 'DevOps Specialist', 'project': 'devsync-core'})
            Membership.objects.get_or_create(team=core_team, user=created_users['rahuldev'], defaults={'role': 'Frontend Architect', 'project': 'devsync-core'})

            # Seed demo Notifications (All 6 categories)
            nav = created_users['naveen3438']
            demo_notifications = [
                {
                    'category': 'connection',
                    'title': 'New Connection Request',
                    'desc': 'Balaji Kumar requested to connect with your developer network.',
                    'actor': 'balajikumar',
                    'unread': True,
                    'payload': {'connection_id': 'conn-balaji', 'mutual_connections': 4}
                },
                {
                    'category': 'repository',
                    'title': 'New star on chaturyanew',
                    'desc': 'Ananya Roy starred your repository chaturyanew.',
                    'actor': 'ananyaroy',
                    'unread': True,
                    'payload': {'repository': 'chaturyanew'}
                },
                {
                    'category': 'pull_request',
                    'title': 'PR Review Approved',
                    'desc': 'Balaji Kumar approved your pull request #39: Improve database schema and add indexes.',
                    'actor': 'balajikumar',
                    'unread': True,
                    'payload': {'pr_number': 39, 'repository': 'devsync-core'}
                },
                {
                    'category': 'issue',
                    'title': 'New comment on Issue #104',
                    'desc': 'Priya S replied: Great! Let us ensure high contrast ratios for accessibility compliance.',
                    'actor': 'priyas',
                    'unread': False,
                    'payload': {'issue_number': 104, 'repository': 'portfolio-site'}
                },
                {
                    'category': 'mention',
                    'title': 'Mentioned in DevSync Architecture Discussion',
                    'desc': 'Vikram Rao mentioned @naveen3438: Can you verify the Argon2 hasher benchmark results?',
                    'actor': 'vikramrao',
                    'unread': True,
                    'payload': {'thread_id': 'thread-argon2'}
                },
                {
                    'category': 'team',
                    'title': 'Added to Chaturya Developers Squad',
                    'desc': 'You were designated as Lead Maintainer for Chaturya Developers open source team.',
                    'actor': 'balajikumar',
                    'unread': False,
                    'payload': {'team': 'chaturya-devs', 'role': 'Lead Maintainer'}
                }
            ]

            for n_data in demo_notifications:
                Notification.objects.get_or_create(
                    recipient=nav,
                    title=n_data['title'],
                    defaults={
                        'category': n_data['category'],
                        'description': n_data['desc'],
                        'actor_username': n_data['actor'],
                        'unread': n_data['unread'],
                        'payload': n_data['payload']
                    }
                )

            # Seed Activity Events for Contribution Intelligence
            import time
            now_ts = time.time()
            demo_events = [
                ('git_commit', 'devsync-core', 'Merge pull request #37: Security whitelist', now_ts - 3600),
                ('pull_request', 'devsync-core', 'Open PR #39: Improve database schema', now_ts - 7200),
                ('review', 'devsync-core', 'Approve PR #35: Argon2 upgrade pipeline', now_ts - 14400),
                ('issue', 'portfolio-site', 'Close Issue #95: Query latency optimization', now_ts - 86400),
                ('comment', 'portfolio-site', 'Comment on Issue #104: Dark mode tokens', now_ts - 100000),
                ('file_uploaded', 'chaturyanew', 'Upload event portal schema', now_ts - 172800),
            ]
            for ev_type, repo_str, ev_title, ev_ts in demo_events:
                ActivityEvent.objects.get_or_create(
                    user=nav,
                    title=ev_title,
                    defaults={
                        'event_type': ev_type,
                        'repository': repo_str,
                        'timestamp': ev_ts
                    }
                )

            # Seed Chat Conversations & Messages
            c1, _ = Conversation.objects.get_or_create(
                custom_id='conv-direct-priya',
                defaults={'title': 'Priya S', 'conv_type': 'direct'}
            )
            c2, _ = Conversation.objects.get_or_create(
                custom_id='conv-direct-balaji',
                defaults={'title': 'Balaji Kumar', 'conv_type': 'direct'}
            )
            c3, _ = Conversation.objects.get_or_create(
                custom_id='conv-group-devsync',
                defaults={'title': 'DevSync Core Squad', 'conv_type': 'group'}
            )

            Participant.objects.get_or_create(conversation=c1, user=nav)
            Participant.objects.get_or_create(conversation=c1, user=created_users['balajikumar'])
            Participant.objects.get_or_create(conversation=c2, user=nav)
            Participant.objects.get_or_create(conversation=c2, user=created_users['balajikumar'])
            Participant.objects.get_or_create(conversation=c3, user=nav)
            Participant.objects.get_or_create(conversation=c3, user=created_users['balajikumar'])
            Participant.objects.get_or_create(conversation=c3, user=created_users['ananyaroy'])

            # Seed sample message in c1
            msg1, _ = Message.objects.get_or_create(
                conversation=c1,
                custom_id='msg-sample-1',
                defaults={
                    'sender': created_users['balajikumar'],
                    'text': 'Hey Naveen, verified the Google OAuth token validation logic!'
                }
            )
            Reaction.objects.get_or_create(message=msg1, user=nav, emoji='🚀')

            # Seed 24h developer statuses
            StatusUpdate.create_status(user=nav, text='🚀 DevSync Master Upgrade fully operational across frontend and backend!')
            StatusUpdate.create_status(user=created_users['balajikumar'], text='Benchmarking Argon2 password hashing latency against Postgres 16.')

        self.stdout.write(self.style.SUCCESS("Demo data seeding completed successfully!"))
