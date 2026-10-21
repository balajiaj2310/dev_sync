import json
import os
import uuid
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.hashers import make_password, identify_hasher

from apps.accounts.models import User, Profile, Skill, Education, Experience, Achievement
from apps.repositories.models import Repository, Branch, Commit
from apps.issues.models import Issue, IssueComment
from apps.pulls.models import PullRequest
from apps.teams.models import Team, Membership
from apps.chat.models import Conversation, Participant, Message, StatusUpdate
from apps.notifications.models import Notification


class Command(BaseCommand):
    help = "Import data from data/devsync_database.json into Django models atomically."

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='data/devsync_database.json',
            help='Path to the JSON database file to import'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        if not os.path.exists(file_path):
            raise CommandError(f"Database file not found: {file_path}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Corrupt JSON file: {e}")
        except Exception as e:
            raise CommandError(f"Failed to read file: {e}")

        # Schema validation: profiles and repositories are required top-level keys
        if not isinstance(data, dict):
            raise CommandError("Schema mismatch: root object must be a dictionary.")

        if 'profiles' not in data or not isinstance(data['profiles'], dict):
            raise CommandError("Schema mismatch: missing or invalid 'profiles' dictionary.")

        if 'repositories' not in data or not isinstance(data['repositories'], (dict, list)):
            raise CommandError("Schema mismatch: missing or invalid 'repositories' key.")

        self.stdout.write(self.style.NOTICE("Schema valid. Beginning atomic transactional import..."))

        try:
            with transaction.atomic():
                user_map = {}

                # 1. Import Profiles / Users
                for username_key, p_data in data['profiles'].items():
                    if not isinstance(p_data, dict):
                        raise CommandError(f"Schema mismatch in profile '{username_key}'.")

                    username = p_data.get('username', username_key).strip().lower()
                    email = p_data.get('email', f"{username}@devsync.local").strip().lower()
                    raw_pwd = p_data.get('password', 'DevSyncDemoPass2026!')

                    # Hash password if plaintext
                    try:
                        identify_hasher(raw_pwd)
                        pwd_to_save = raw_pwd
                    except ValueError:
                        # Plaintext - hash with default hasher (Argon2)
                        pwd_to_save = make_password(raw_pwd)

                    user, _ = User.objects.update_or_create(
                        username=username,
                        defaults={
                            'email': email,
                            'password': pwd_to_save,
                            'is_email_verified': p_data.get('isVerified', True),
                        }
                    )
                    user_map[username] = user

                    # Profile
                    socials = p_data.get('social', {})
                    collab_status = p_data.get('collaborationStatus', 'open_to_collab')
                    if collab_status not in ['open_to_collab', 'available_for_hire', 'mentoring', 'busy']:
                        collab_status = 'open_to_collab'

                    Profile.objects.update_or_create(
                        user=user,
                        defaults={
                            'headline': p_data.get('headline', '')[:160],
                            'bio': p_data.get('bio', '')[:2000],
                            'location': p_data.get('location', '')[:120],
                            'website': p_data.get('website', '') if str(p_data.get('website', '')).startswith('http') else '',
                            'github_url': socials.get('github', '') if str(socials.get('github', '')).startswith('http') else '',
                            'linkedin_url': socials.get('linkedin', '') if str(socials.get('linkedin', '')).startswith('http') else '',
                            'twitter_url': socials.get('twitter', '') if str(socials.get('twitter', '')).startswith('http') else '',
                            'collaboration_status': collab_status,
                        }
                    )

                    # Skills
                    for sk in p_data.get('skills', []):
                        if isinstance(sk, str) and sk.strip():
                            Skill.objects.get_or_create(user=user, name=sk.strip())

                    # Education
                    edu = p_data.get('education')
                    if isinstance(edu, dict) and edu.get('institution'):
                        Education.objects.update_or_create(
                            user=user,
                            institution=edu.get('institution'),
                            defaults={
                                'degree': edu.get('degree', ''),
                                'field_of_study': edu.get('field', ''),
                            }
                        )

                    # Experience
                    for exp in p_data.get('experience', []):
                        if isinstance(exp, dict) and (exp.get('organization') or exp.get('company')):
                            company_name = exp.get('company') or exp.get('organization')
                            role_title = exp.get('title') or exp.get('role', 'Developer')
                            Experience.objects.update_or_create(
                                user=user,
                                company=company_name,
                                title=role_title,
                                defaults={
                                    'description': exp.get('description', ''),
                                }
                            )

                default_user = next(iter(user_map.values())) if user_map else None

                # 2. Import Repositories
                repos_raw = data.get('repositories', {})
                repo_list = repos_raw.values() if isinstance(repos_raw, dict) else repos_raw

                for r_data in repo_list:
                    if not isinstance(r_data, dict):
                        continue
                    repo_name = r_data.get('name', 'devsync-core')
                    owner_name = r_data.get('owner', '')
                    owner = user_map.get(owner_name.lower(), default_user)
                    if not owner:
                        continue

                    visibility = 'private' if r_data.get('is_private') or str(r_data.get('visibility')).lower() == 'private' else 'public'
                    repo, _ = Repository.objects.update_or_create(
                        name=repo_name,
                        defaults={
                            'owner': owner,
                            'slug': r_data.get('slug', repo_name),
                            'description': r_data.get('description', ''),
                            'visibility': visibility,
                            'default_branch': r_data.get('default_branch', 'main'),
                            'stars_count': r_data.get('stars_count', 0),
                            'forks_count': r_data.get('forks_count', 0),
                        }
                    )
                    Branch.objects.get_or_create(repository=repo, name=repo.default_branch)

                # 3. Import Issues
                issues_raw = data.get('issues', {})
                issue_list = issues_raw.values() if isinstance(issues_raw, dict) else issues_raw
                for i_data in issue_list:
                    if not isinstance(i_data, dict):
                        continue
                    author_name = i_data.get('author', '')
                    author = user_map.get(author_name.lower(), default_user)
                    repo_id = i_data.get('repository', 'devsync-core')
                    repo = Repository.objects.filter(name__iexact=repo_id).first()
                    if not repo:
                        repo = Repository.objects.first()
                    if not repo or not author:
                        continue

                    Issue.objects.update_or_create(
                        number=i_data.get('number', 101),
                        repository=repo,
                        defaults={
                            'title': i_data.get('title', 'Untitled Issue'),
                            'description': i_data.get('description', ''),
                            'status': i_data.get('status', 'Open'),
                            'author': author,
                        }
                    )

                # 4. Import Pull Requests
                prs_raw = data.get('pull_requests', {})
                pr_list = prs_raw.values() if isinstance(prs_raw, dict) else prs_raw
                for pr_data in pr_list:
                    if not isinstance(pr_data, dict):
                        continue
                    author_name = pr_data.get('author', '')
                    author = user_map.get(author_name.lower(), default_user)
                    repo_id = pr_data.get('repository', 'devsync-core')
                    repo = Repository.objects.filter(name__iexact=repo_id).first()
                    if not repo:
                        repo = Repository.objects.first()
                    if not repo or not author:
                        continue

                    PullRequest.objects.update_or_create(
                        number=pr_data.get('number', 101),
                        repository=repo,
                        defaults={
                            'title': pr_data.get('title', 'Untitled PR'),
                            'description': pr_data.get('description', ''),
                            'source_branch': pr_data.get('source_branch', 'feature'),
                            'target_branch': pr_data.get('target_branch', 'main'),
                            'status': pr_data.get('status', 'Open'),
                            'author': author,
                        }
                    )

                # 5. Import Teams
                teams_raw = data.get('teams', {})
                team_items = teams_raw.items() if isinstance(teams_raw, dict) else [(t.get('name', f"team-{i}"), t) for i, t in enumerate(teams_raw)]
                for t_key, t_data in team_items:
                    if not isinstance(t_data, dict):
                        continue
                    slug = t_data.get('slug') or t_key
                    team_title = t_data.get('title') or t_data.get('name') or slug
                    owner_name = t_data.get('ownerUsername') or t_data.get('created_by', '')
                    created_by = user_map.get(owner_name.lower(), default_user)
                    if not created_by:
                        continue

                    team, _ = Team.objects.update_or_create(
                        slug=slug,
                        defaults={
                            'name': team_title,
                            'description': t_data.get('description', ''),
                            'created_by': created_by,
                        }
                    )

                    for m_name in t_data.get('memberUsernames', []):
                        m_user = user_map.get(str(m_name).lower())
                        if m_user:
                            Membership.objects.get_or_create(
                                team=team,
                                user=m_user,
                                defaults={'role': 'Contributor', 'project': team.name}
                            )

                # 6. Import Status Updates
                statuses_raw = data.get('status_updates', [])
                if isinstance(statuses_raw, list):
                    for s_data in statuses_raw:
                        if not isinstance(s_data, dict):
                            continue
                        author_name = s_data.get('author') or s_data.get('user', '')
                        author = user_map.get(str(author_name).lower(), default_user)
                        if author and s_data.get('text'):
                            StatusUpdate.objects.create(
                                user=author,
                                text=s_data.get('text'),
                                audience=s_data.get('audience', 'everyone'),
                                expires_at=timezone.now() + timezone.timedelta(hours=24)
                            )

            self.stdout.write(self.style.SUCCESS("DevSync database successfully imported atomically!"))
        except CommandError:
            raise
        except Exception as e:
            raise CommandError(f"Import failed and was rolled back atomically: {e}")
