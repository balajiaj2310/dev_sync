"""
DevSync Workspace Engine
Provides full file operations (tree, read, create, save, rename, delete),
ZIP archive generation, execution integration, Git status/commit tracking,
and external IDE integration (VS Code, PyCharm, IntelliJ, Eclipse, Visual Studio, CLI).
"""

import os
import io
import time
import json
import zipfile
import secrets
import hashlib
import urllib.parse
from typing import Dict, List, Any, Optional, Tuple

from backend_collaboration import (
    REPOSITORIES, ACTIVITY_EVENTS, get_repository_by_id_or_name,
    check_repo_permissions, record_activity_event, sanitize_file_path
)

from backend_execution import (
    SUPPORTED_LANGUAGES, ExecutionProviderFactory, ExecutionRequest,
    ExecutionResult, ExecutionHistoryStore, detect_language_from_path,
    normalize_language
)


def _get_user_name(auth_user: Any) -> str:
    if not auth_user:
        return 'anonymous'
    if isinstance(auth_user, dict):
        return auth_user.get('username', 'anonymous')
    return getattr(auth_user, 'username', str(auth_user))


def get_workspace_info(repo_id_or_name: str, auth_user: Any = None) -> Tuple[bool, Dict[str, Any], int]:
    """
    Retrieve repository workspace configuration, metadata, and user permissions.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to access this repository workspace.'}, 403

    can_edit = bool(is_owner or is_maint or is_collab)
    can_commit = can_edit
    can_admin = bool(is_owner or is_maint)

    # Compute language & file stats
    files_map = repo.get('files', {})
    branches = repo.get('branches', ['main'])
    default_branch = repo.get('defaultBranch', 'main')
    
    total_files = sum(len(flist) for flist in files_map.values())
    default_branch_files = len(files_map.get(default_branch, []))

    # Supported language list with Monaco editor metadata
    lang_info = []
    for lang_key, meta in SUPPORTED_LANGUAGES.items():
        lang_info.append({
            'key': lang_key,
            'name': meta.get('name', lang_key.title()),
            'monacoId': meta.get('monaco_lang', lang_key),
            'extension': meta.get('extension', f".{lang_key}"),
            'version': meta.get('version', 'latest'),
            'defaultFileName': f"main{meta.get('extension', f'.{lang_key}')}",
            'boilerplate': meta.get('boilerplate', '')
        })

    return True, {
        'repository': repo['name'],
        'id': repo.get('id', f"repo-{repo['name']}"),
        'owner': repo.get('owner', 'devsync'),
        'description': repo.get('description', ''),
        'visibility': repo.get('visibility', 'Public'),
        'defaultBranch': default_branch,
        'branches': branches,
        'userRole': role or 'Viewer',
        'permissions': {
            'canView': can_view,
            'canEdit': can_edit,
            'canCommit': can_commit,
            'canAdmin': can_admin,
            'isReadOnly': not can_edit
        },
        'supportedLanguages': lang_info,
        'stats': {
            'totalFiles': total_files,
            'defaultBranchFiles': default_branch_files,
            'branchesCount': len(branches),
            'membersCount': len(repo.get('members', []))
        }
    }, 200


def get_workspace_tree(repo_id_or_name: str, branch: Optional[str] = None, auth_user: Any = None) -> Tuple[bool, Dict[str, Any], int]:
    """
    Retrieve file tree for a branch, returning both flat file list and nested directory tree.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to view this repository workspace.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    if target_branch not in repo.get('branches', []):
        return False, {'error': f"Branch '{target_branch}' not found on repository '{repo['name']}'"}, 404

    branch_files = repo.get('files', {}).get(target_branch, [])

    flat_list = []
    tree_root: Dict[str, Any] = {'name': 'root', 'path': '', 'type': 'directory', 'children': {}}

    for f in branch_files:
        f_path = f.get('path', '').replace('\\', '/').strip('/')
        if not f_path:
            continue

        ext = os.path.splitext(f_path)[1].lower()
        lang = detect_language_from_path(f_path)

        file_item = {
            'path': f_path,
            'name': f.get('name', os.path.basename(f_path)),
            'type': 'file',
            'branch': target_branch,
            'size': f.get('size', len(f.get('content', ''))),
            'updated_at': f.get('updated_at', repo.get('updated_at', time.time())),
            'last_commit': f.get('last_commit', 'Initial commit'),
            'last_actor': f.get('last_actor', repo.get('owner', 'devsync')),
            'sha256': f.get('sha256', ''),
            'language': lang,
            'extension': ext
        }
        flat_list.append(file_item)

        # Build nested tree
        parts = f_path.split('/')
        curr = tree_root
        curr_path = ''
        for i, part in enumerate(parts[:-1]):
            curr_path = f"{curr_path}/{part}" if curr_path else part
            if part not in curr['children']:
                curr['children'][part] = {
                    'name': part,
                    'path': curr_path,
                    'type': 'directory',
                    'children': {}
                }
            curr = curr['children'][part]

        file_name = parts[-1]
        curr['children'][file_name] = file_item

    def _convert_children(node: Dict[str, Any]) -> Dict[str, Any]:
        if node.get('type') == 'directory':
            children_dict = node.get('children', {})
            sorted_keys = sorted(
                children_dict.keys(),
                key=lambda k: (0 if children_dict[k].get('type') == 'directory' else 1, k.lower())
            )
            node['children'] = [_convert_children(children_dict[k]) for k in sorted_keys]
        return node

    nested_tree = [_convert_children(v) for _, v in sorted(
        tree_root['children'].items(),
        key=lambda item: (0 if item[1].get('type') == 'directory' else 1, item[0].lower())
    )]

    return True, {
        'repository': repo['name'],
        'branch': target_branch,
        'count': len(flat_list),
        'files': flat_list,
        'tree': nested_tree
    }, 200


def get_workspace_file(repo_id_or_name: str, branch: Optional[str], file_path: str, auth_user: Any = None) -> Tuple[bool, Dict[str, Any], int]:
    """
    Read full file content and metadata safely.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to view file contents.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    clean_path, err = sanitize_file_path(file_path)
    if err:
        return False, {'error': 'Invalid path', 'detail': err}, 400

    branch_files = repo.get('files', {}).get(target_branch, [])
    matched = next((f for f in branch_files if f.get('path') == clean_path), None)

    content = ''
    size = 0
    updated_at = time.time()
    last_commit = 'Initial commit'
    last_actor = repo.get('owner', 'devsync')
    sha256 = ''

    if matched:
        content = matched.get('content', '')
        size = matched.get('size', len(content))
        updated_at = matched.get('updated_at', updated_at)
        last_commit = matched.get('last_commit', last_commit)
        last_actor = matched.get('last_actor', last_actor)
        sha256 = matched.get('sha256', '')

    # If content empty or not in memory, attempt physical disk read
    if not content:
        disk_path = os.path.join('data', 'repositories', repo['name'], 'branches', target_branch, clean_path.replace('/', os.sep))
        if os.path.isfile(disk_path):
            try:
                with open(disk_path, 'r', encoding='utf-8', errors='replace') as df:
                    content = df.read()
                size = os.path.getsize(disk_path)
                updated_at = os.path.getmtime(disk_path)
                sha256 = hashlib.sha256(content.encode('utf-8')).hexdigest()
            except Exception as e:
                return False, {'error': f"Failed to read file from disk: {e}"}, 500

    if not matched and not content and not os.path.isfile(os.path.join('data', 'repositories', repo['name'], 'branches', target_branch, clean_path.replace('/', os.sep))):
        return False, {'error': f"File '{clean_path}' not found on branch '{target_branch}'"}, 404

    lang = detect_language_from_path(clean_path)
    ext = os.path.splitext(clean_path)[1].lower()

    return True, {
        'repository': repo['name'],
        'branch': target_branch,
        'path': clean_path,
        'name': os.path.basename(clean_path),
        'content': content,
        'size': len(content.encode('utf-8')),
        'language': lang,
        'extension': ext,
        'sha256': sha256 or hashlib.sha256(content.encode('utf-8')).hexdigest(),
        'updated_at': updated_at,
        'last_commit': last_commit,
        'last_actor': last_actor
    }, 200


def save_workspace_file(
    repo_id_or_name: str,
    branch: Optional[str],
    file_path: str,
    content: str,
    commit_message: Optional[str] = None,
    auth_user: Any = None,
    base_data_dir: str = 'data'
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Save or update file content on branch, writing to disk and updating in-memory state.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not (is_owner or is_maint or is_collab):
        return False, {'error': 'Forbidden: You do not have write access to this repository workspace.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    if target_branch not in repo.get('branches', []):
        return False, {'error': f"Branch '{target_branch}' does not exist on this repository."}, 400

    clean_path, err = sanitize_file_path(file_path)
    if err:
        return False, {'error': 'Invalid path', 'detail': err}, 400

    if not isinstance(content, str):
        content = str(content)

    content_bytes = content.encode('utf-8')
    if len(content_bytes) > 10 * 1024 * 1024:
        return False, {'error': 'File too large', 'detail': 'Workspace file exceeds 10 MB limit.'}, 400

    actor_username = _get_user_name(auth_user)
    sha256_hash = hashlib.sha256(content_bytes).hexdigest()
    now = time.time()

    # Write physically to disk
    disk_path = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, clean_path.replace('/', os.sep))
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, 'wb') as f:
        f.write(content_bytes)

    repo_files = repo.setdefault('files', {})
    branch_files = repo_files.setdefault(target_branch, [])

    summary = (commit_message or '').strip() or f"Update {clean_path}"

    file_entry = {
        'path': clean_path,
        'name': os.path.basename(clean_path),
        'type': 'file',
        'size': len(content_bytes),
        'updated_at': now,
        'last_commit': summary,
        'last_actor': actor_username,
        'sha256': sha256_hash,
        'content': content
    }

    existing_idx = next((i for i, f in enumerate(branch_files) if f.get('path') == clean_path), None)
    if existing_idx is not None:
        branch_files[existing_idx] = file_entry
    else:
        branch_files.append(file_entry)

    repo['updated_at'] = now

    audit_entry = {
        'id': f"aud_{secrets.token_hex(6)}",
        'action': 'file_save' if existing_idx is not None else 'file_create',
        'branch': target_branch,
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
        branch=target_branch,
        title=f"Saved {clean_path} in workspace",
        description=summary,
        metadata={'file_path': clean_path, 'sha256': sha256_hash, 'size': len(content_bytes)},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'path': clean_path,
        'branch': target_branch,
        'size': len(content_bytes),
        'sha256': sha256_hash,
        'updated_at': now,
        'commitMessage': summary
    }, 200


def create_workspace_file_or_folder(
    repo_id_or_name: str,
    branch: Optional[str],
    path: str,
    item_type: str = 'file',
    initial_content: str = '',
    commit_message: Optional[str] = None,
    auth_user: Any = None,
    base_data_dir: str = 'data'
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Create a new file or directory on the branch with path validation and collision check.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not (is_owner or is_maint or is_collab):
        return False, {'error': 'Forbidden: You do not have write access to create files.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    clean_path, err = sanitize_file_path(path)
    if err:
        return False, {'error': 'Invalid path', 'detail': err}, 400

    repo_files = repo.setdefault('files', {})
    branch_files = repo_files.setdefault(target_branch, [])

    if any(f.get('path') == clean_path for f in branch_files):
        return False, {'error': 'Conflict: A file or directory with this path already exists.'}, 409

    actor_username = _get_user_name(auth_user)
    now = time.time()
    disk_path = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, clean_path.replace('/', os.sep))

    if item_type.lower() in ('dir', 'directory', 'folder'):
        os.makedirs(disk_path, exist_ok=True)
        # Create .gitkeep placeholder inside empty folder to preserve it
        gitkeep_path = f"{clean_path}/.gitkeep"
        branch_files.append({
            'path': gitkeep_path,
            'name': '.gitkeep',
            'type': 'file',
            'size': 0,
            'updated_at': now,
            'last_commit': f"Create directory {clean_path}",
            'last_actor': actor_username,
            'sha256': hashlib.sha256(b'').hexdigest(),
            'content': ''
        })
        with open(os.path.join(disk_path, '.gitkeep'), 'w', encoding='utf-8') as f:
            f.write('')
    else:
        # File creation
        os.makedirs(os.path.dirname(disk_path), exist_ok=True)
        content_bytes = initial_content.encode('utf-8') if isinstance(initial_content, str) else initial_content
        with open(disk_path, 'wb') as f:
            f.write(content_bytes)

        summary = (commit_message or '').strip() or f"Create {clean_path}"
        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

        file_entry = {
            'path': clean_path,
            'name': os.path.basename(clean_path),
            'type': 'file',
            'size': len(content_bytes),
            'updated_at': now,
            'last_commit': summary,
            'last_actor': actor_username,
            'sha256': sha256_hash,
            'content': initial_content
        }
        branch_files.append(file_entry)

    repo['updated_at'] = now

    record_activity_event(
        'file_uploaded',
        actor_username,
        repo['name'],
        branch=target_branch,
        title=f"Created {item_type} {clean_path}",
        description=commit_message or f"Created {clean_path}",
        metadata={'path': clean_path, 'type': item_type},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'path': clean_path,
        'name': os.path.basename(clean_path),
        'type': item_type,
        'branch': target_branch,
        'updated_at': now
    }, 201


def rename_workspace_path(
    repo_id_or_name: str,
    branch: Optional[str],
    old_path: str,
    new_path: str,
    commit_message: Optional[str] = None,
    auth_user: Any = None,
    base_data_dir: str = 'data'
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Rename a file or entire directory tree on the branch, updating both disk and in-memory state.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not (is_owner or is_maint or is_collab):
        return False, {'error': 'Forbidden: You do not have write access to rename paths.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    clean_old, err1 = sanitize_file_path(old_path)
    clean_new, err2 = sanitize_file_path(new_path)
    if err1 or err2:
        return False, {'error': 'Invalid path', 'detail': err1 or err2}, 400

    if clean_old == clean_new:
        return True, {'success': True, 'oldPath': clean_old, 'newPath': clean_new, 'renamedCount': 0}, 200

    repo_files = repo.setdefault('files', {})
    branch_files = repo_files.setdefault(target_branch, [])

    # Identify matching files (exact match or subtree)
    matched_exact = [f for f in branch_files if f.get('path') == clean_old]
    matched_dir = [f for f in branch_files if f.get('path', '').startswith(clean_old + '/')]

    if not matched_exact and not matched_dir:
        return False, {'error': f"Path '{clean_old}' not found on branch '{target_branch}'"}, 404

    actor_username = _get_user_name(auth_user)
    now = time.time()
    summary = (commit_message or '').strip() or f"Rename {clean_old} to {clean_new}"
    renamed_count = 0

    if matched_exact:
        f = matched_exact[0]
        old_disk = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, clean_old.replace('/', os.sep))
        new_disk = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, clean_new.replace('/', os.sep))

        if os.path.isfile(old_disk):
            os.makedirs(os.path.dirname(new_disk), exist_ok=True)
            try:
                os.replace(old_disk, new_disk)
            except Exception:
                pass

        f['path'] = clean_new
        f['name'] = os.path.basename(clean_new)
        f['updated_at'] = now
        f['last_commit'] = summary
        f['last_actor'] = actor_username
        renamed_count = 1

    for f in matched_dir:
        old_item_path = f.get('path')
        suffix = old_item_path[len(clean_old):]
        new_item_path = f"{clean_new}{suffix}"

        old_disk = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, old_item_path.replace('/', os.sep))
        new_disk = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, new_item_path.replace('/', os.sep))

        if os.path.isfile(old_disk):
            os.makedirs(os.path.dirname(new_disk), exist_ok=True)
            try:
                os.replace(old_disk, new_disk)
            except Exception:
                pass

        f['path'] = new_item_path
        f['name'] = os.path.basename(new_item_path)
        f['updated_at'] = now
        f['last_commit'] = summary
        f['last_actor'] = actor_username
        renamed_count += 1

    repo['updated_at'] = now

    audit_entry = {
        'id': f"aud_{secrets.token_hex(6)}",
        'action': 'path_rename',
        'branch': target_branch,
        'old_path': clean_old,
        'new_path': clean_new,
        'actor': actor_username,
        'timestamp': now,
        'summary': summary,
        'renamed_count': renamed_count
    }
    repo.setdefault('audit_log', []).insert(0, audit_entry)

    record_activity_event(
        'file_uploaded',
        actor_username,
        repo['name'],
        branch=target_branch,
        title=f"Renamed {clean_old} to {clean_new}",
        description=summary,
        metadata={'old_path': clean_old, 'new_path': clean_new, 'renamed_count': renamed_count},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'oldPath': clean_old,
        'newPath': clean_new,
        'renamedCount': renamed_count,
        'branch': target_branch
    }, 200


def delete_workspace_path(
    repo_id_or_name: str,
    branch: Optional[str],
    path: str,
    commit_message: Optional[str] = None,
    auth_user: Any = None,
    base_data_dir: str = 'data'
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Delete a file or directory tree on the branch, cleaning disk and updating in-memory state.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not (is_owner or is_maint or is_collab):
        return False, {'error': 'Forbidden: You do not have write access to delete paths.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    clean_path, err = sanitize_file_path(path)
    if err:
        return False, {'error': 'Invalid path', 'detail': err}, 400

    repo_files = repo.setdefault('files', {})
    branch_files = repo_files.setdefault(target_branch, [])

    to_remove = [
        f for f in branch_files
        if f.get('path') == clean_path or f.get('path', '').startswith(clean_path + '/')
    ]

    if not to_remove:
        return False, {'error': f"Path '{clean_path}' not found on branch '{target_branch}'"}, 404

    actor_username = _get_user_name(auth_user)
    now = time.time()
    summary = (commit_message or '').strip() or f"Delete {clean_path}"

    for f in to_remove:
        branch_files.remove(f)
        f_disk = os.path.join(base_data_dir, 'repositories', repo['name'], 'branches', target_branch, f.get('path', '').replace('/', os.sep))
        if os.path.isfile(f_disk):
            try:
                os.remove(f_disk)
            except Exception:
                pass

    repo['updated_at'] = now

    audit_entry = {
        'id': f"aud_{secrets.token_hex(6)}",
        'action': 'path_delete',
        'branch': target_branch,
        'file_path': clean_path,
        'actor': actor_username,
        'timestamp': now,
        'summary': summary,
        'deleted_count': len(to_remove)
    }
    repo.setdefault('audit_log', []).insert(0, audit_entry)

    record_activity_event(
        'file_uploaded',
        actor_username,
        repo['name'],
        branch=target_branch,
        title=f"Deleted {clean_path}",
        description=summary,
        metadata={'deleted_path': clean_path, 'deleted_count': len(to_remove)},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'deletedPath': clean_path,
        'deletedCount': len(to_remove),
        'branch': target_branch
    }, 200


def create_workspace_zip_archive(
    repo_id_or_name: str,
    branch: Optional[str] = None,
    auth_user: Any = None
) -> Tuple[bool, Any, str, int]:
    """
    Generate an in-memory ZIP archive of all files for the specified branch.
    Returns (success, zip_bytes_or_error_dict, filename, status_code).
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, '', 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to download this repository.'}, '', 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    branch_files = repo.get('files', {}).get(target_branch, [])

    zip_buffer = io.BytesIO()
    root_folder = f"{repo['name']}-{target_branch}"

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # If no files exist, add a README placeholder
        if not branch_files:
            zip_file.writestr(
                f"{root_folder}/README.md",
                f"# {repo['name']}\n\nBranch: {target_branch}\nNo files uploaded yet.\n"
            )
        else:
            for f in branch_files:
                f_path = f.get('path', '').strip('/')
                if not f_path or f.get('name') == '.gitkeep':
                    continue
                content = f.get('content', '')
                if not content:
                    disk_path = os.path.join('data', 'repositories', repo['name'], 'branches', target_branch, f_path.replace('/', os.sep))
                    if os.path.isfile(disk_path):
                        try:
                            with open(disk_path, 'r', encoding='utf-8', errors='replace') as df:
                                content = df.read()
                        except Exception:
                            content = ''

                archive_path = f"{root_folder}/{f_path}"
                zip_file.writestr(archive_path, content)

    zip_buffer.seek(0)
    filename = f"{repo['name']}-{target_branch}.zip"
    return True, zip_buffer.getvalue(), filename, 200


def execute_workspace_code(
    repo_id_or_name: str,
    branch: Optional[str],
    file_path: Optional[str],
    source_code: str,
    language: Optional[str] = None,
    stdin: str = '',
    args: Optional[List[str]] = None,
    auth_user: Any = None,
    provider_name: Optional[str] = None
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Execute user source code via the configured sandbox provider abstraction.
    Records execution to ExecutionHistoryStore and returns structured execution result.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to execute code in this repository.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')

    # Resolve language
    target_lang = normalize_language(language) if language else None
    if not target_lang and file_path:
        target_lang = detect_language_from_path(file_path)

    if not target_lang or target_lang not in SUPPORTED_LANGUAGES:
        supported = list(SUPPORTED_LANGUAGES.keys())
        return False, {
            'error': f"Unsupported or unrecognized language '{language or file_path}'.",
            'supportedLanguages': supported
        }, 400

    if not source_code or not source_code.strip():
        return False, {'error': 'Source code cannot be empty.'}, 400

    provider = ExecutionProviderFactory.get_provider(provider_name)
    actor_username = _get_user_name(auth_user)
    file_name = os.path.basename(file_path) if file_path else f"main{SUPPORTED_LANGUAGES[target_lang].get('extension', f'.{target_lang}')}"
    request = ExecutionRequest(
        language=target_lang,
        source_code=source_code,
        stdin=stdin or '',
        file_name=file_name,
        workspace_id=repo['name'],
        user_id=actor_username
    )

    result = provider.execute(request)

    # Record in history store
    ExecutionHistoryStore.record(
        repo_name=repo['name'],
        result=result,
        req=request
    )

    return True, result.to_dict(), 200


def get_workspace_execution_history(
    repo_id_or_name: str,
    limit: int = 20,
    auth_user: Any = None
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Retrieve recent execution history for this repository.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to view execution history.'}, 403

    history = ExecutionHistoryStore.get_history(repo['name'], limit=limit)
    return True, {
        'repository': repo['name'],
        'history': history,
        'count': len(history)
    }, 200


def get_workspace_git_status(
    repo_id_or_name: str,
    branch: Optional[str] = None,
    auth_user: Any = None
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Retrieve Git status, branch list, and recent commit history for the workspace.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to view Git status.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    branches = repo.get('branches', ['main'])

    # Recent audit log items matching this branch
    branch_audits = [
        item for item in repo.get('audit_log', [])
        if item.get('branch') == target_branch
    ][:15]

    return True, {
        'repository': repo['name'],
        'currentBranch': target_branch,
        'defaultBranch': repo.get('defaultBranch', 'main'),
        'branches': branches,
        'recentCommits': branch_audits,
        'lastUpdated': repo.get('updated_at', time.time())
    }, 200


def commit_workspace_changes(
    repo_id_or_name: str,
    branch: Optional[str],
    message: str,
    files: Optional[List[str]] = None,
    auth_user: Any = None
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Create a Git-style commit record on the target branch.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not (is_owner or is_maint or is_collab):
        return False, {'error': 'Forbidden: You do not have write access to commit changes.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    if not message or not message.strip():
        return False, {'error': 'Commit message is required.'}, 400

    actor_username = _get_user_name(auth_user)
    sha_hash = secrets.token_hex(20)
    now = time.time()

    commit_entry = {
        'id': f"cmt_{sha_hash[:12]}",
        'sha': sha_hash,
        'short_sha': sha_hash[:7],
        'branch': target_branch,
        'message': message.strip(),
        'actor': actor_username,
        'timestamp': now,
        'files_count': len(files) if files else len(repo.get('files', {}).get(target_branch, []))
    }

    repo.setdefault('audit_log', []).insert(0, commit_entry)
    repo['updated_at'] = now

    record_activity_event(
        'commit',
        actor_username,
        repo['name'],
        branch=target_branch,
        title=f"Committed {sha_hash[:7]} to {target_branch}",
        description=message.strip(),
        metadata={'sha': sha_hash, 'branch': target_branch},
        visibility=repo.get('visibility', 'Public')
    )

    return True, {
        'success': True,
        'sha': sha_hash,
        'shortSha': sha_hash[:7],
        'branch': target_branch,
        'message': message.strip(),
        'actor': actor_username,
        'timestamp': now
    }, 201


def get_external_ide_config(
    repo_id_or_name: str,
    branch: Optional[str] = None,
    host_url: str = 'http://localhost:8000',
    auth_user: Any = None
) -> Tuple[bool, Dict[str, Any], int]:
    """
    Generate external IDE integration deep-links, clone URLs, and setup instructions
    for VS Code, PyCharm, IntelliJ IDEA, Eclipse, Visual Studio, and CLI.
    """
    repo = get_repository_by_id_or_name(repo_id_or_name)
    if not repo:
        return False, {'error': f"Repository '{repo_id_or_name}' not found"}, 404

    can_view, role, is_owner, is_maint, is_collab = check_repo_permissions(auth_user, repo)
    if not can_view:
        return False, {'error': 'Forbidden: You do not have permission to access IDE configuration.'}, 403

    target_branch = branch or repo.get('defaultBranch', 'main')
    clean_host = host_url.rstrip('/')
    repo_name = repo['name']

    https_clone_url = f"{clean_host}/git/{repo_name}.git"
    ssh_clone_url = f"git@devsync.io:{repo_name}.git"

    # IDE Deep Links
    encoded_https = urllib.parse.quote(https_clone_url, safe='')
    ide_links = {
        'vscode': {
            'name': 'Visual Studio Code',
            'protocol': f"vscode://vscode.git/clone?url={encoded_https}",
            'icon': 'vscode',
            'instructions': 'Opens directly in VS Code and prompts for destination folder.'
        },
        'pycharm': {
            'name': 'PyCharm',
            'protocol': f"jetbrains://pycharm/checkout/git?checkout.repo={encoded_https}",
            'icon': 'pycharm',
            'instructions': 'Initiates Git checkout in JetBrains PyCharm.'
        },
        'intellij': {
            'name': 'IntelliJ IDEA',
            'protocol': f"jetbrains://idea/checkout/git?checkout.repo={encoded_https}",
            'icon': 'intellij',
            'instructions': 'Initiates Git checkout in JetBrains IntelliJ IDEA.'
        },
        'eclipse': {
            'name': 'Eclipse IDE',
            'protocol': f"eclipse://git/clone?url={encoded_https}",
            'icon': 'eclipse',
            'instructions': 'Uses Eclipse Git integration to clone project workspace.'
        },
        'visualstudio': {
            'name': 'Visual Studio',
            'protocol': f"git-client://clone?url={encoded_https}",
            'icon': 'visualstudio',
            'instructions': 'Opens Visual Studio Git Clone dialog.'
        }
    }

    cli_setup = {
        'clone': f"git clone -b {target_branch} {https_clone_url}",
        'cd': f"cd {repo_name}",
        'pythonSetup': "python -m venv venv && source venv/bin/activate && pip install -r requirements.txt",
        'nodeSetup': "npm install && npm start",
        'pull': f"git pull origin {target_branch}"
    }

    archive_url = f"/api/v1/workspace/{repo_name}/archive.zip?branch={target_branch}"

    return True, {
        'repository': repo_name,
        'branch': target_branch,
        'cloneUrls': {
            'https': https_clone_url,
            'ssh': ssh_clone_url
        },
        'ideLinks': ide_links,
        'cliSetup': cli_setup,
        'archiveUrl': archive_url
    }, 200
