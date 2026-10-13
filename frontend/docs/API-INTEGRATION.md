# DevSync Backend Integration & API Contract Specification

This document defines the REST API contracts, Django route bindings, and payload expectations connecting the DevSync frontend to the upcoming Django 5.x / PostgreSQL backend.

---

## 1. Django URL Route Bindings

```python
# devsync/urls.py
from django.urls import path, include

urlpatterns = [
    # Template View Endpoints
    path('', views.home_view, name='home'),
    path('explore/', views.explore_view, name='explore'),
    path('pricing/', views.pricing_view, name='pricing'),
    path('contact/', views.contact_view, name='contact'),
    path('auth/sign-in/', views.sign_in_view, name='sign_in'),
    path('auth/sign-up/', views.sign_up_view, name='sign_up'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('repositories/', views.repo_list_view, name='repo_list'),
    path('repositories/new/', views.repo_create_view, name='repo_create'),
    path('repositories/<str:owner>/<str:repo>/', views.repo_detail_view, name='repo_detail'),
    path('pull-requests/', views.pr_list_view, name='pr_list'),
    path('issues/', views.issue_list_view, name='issue_list'),
    path('teams/', views.team_list_view, name='team_list'),
    path('developers/discover/', views.discover_view, name='discover'),
    path('community/', views.community_view, name='community'),
    path('assistant/', views.assistant_view, name='assistant'),
    path('analytics/', views.analytics_view, name='analytics'),
    path('notifications/', views.notifications_view, name='notifications'),
    path('settings/', views.settings_view, name='settings'),

    # REST API Endpoints
    path('api/v1/', include('api.urls')),
]
```

---

## 2. API Endpoints & Contracts

### 2.1 Authentication & Profile
- `POST /api/v1/auth/login`
  - Body: `{ "email": "user@example.com", "password": "secure_password" }`
  - Response: `{ "token": "jwt_token...", "user": { "id": "...", "name": "...", "username": "..." } }`
- `POST /api/v1/auth/register`
- `GET /api/v1/user/profile`
- `PUT /api/v1/user/profile`

### 2.2 Repositories
- `GET /api/v1/repositories?search=&language=`
  - Response: Array of Repository objects.
- `POST /api/v1/repositories`
  - Body: `{ "name": "...", "description": "...", "is_private": false, "init_readme": true }`
- `GET /api/v1/repositories/:owner/:name/tree?path=`
- `GET /api/v1/repositories/:owner/:name/commits`
- `GET /api/v1/repositories/:owner/:name/branches`

### 2.3 Pull Requests & Issues
- `GET /api/v1/repositories/:owner/:name/pulls?status=open`
- `POST /api/v1/repositories/:owner/:name/pulls`
- `GET /api/v1/repositories/:owner/:name/issues?status=open`
- `POST /api/v1/repositories/:owner/:name/issues`
- `POST /api/v1/repositories/:owner/:name/issues/:id/comments`

### 2.4 Developer Connections (Instagram-style)
- `GET /api/v1/connections/pending`
- `POST /api/v1/connections/request/:user_id`
- `POST /api/v1/connections/accept/:user_id`
- `DELETE /api/v1/connections/reject/:user_id`

### 2.5 Community & Discord Channels
- `GET /api/v1/community/channels`
- `GET /api/v1/community/channels/:channel_id/messages`
- `POST /api/v1/community/channels/:channel_id/messages`
  - Body: `{ "content": "Hello team!" }`
  - WebSocket: `ws://localhost:8000/ws/community/:channel_id/` (Django Channels)

### 2.6 AI Assistant
- `POST /api/v1/assistant/chat`
  - Body: `{ "message": "Refactor this function", "context_file": "utils.js" }`
  - Response: `{ "response": "Here is the refactored code...", "diff": "..." }`

---

## 3. Switching from Mock to Live Backend

In `frontend/src/js/config/app-config.js`:
```javascript
export const APP_CONFIG = {
  appName: 'DevSync',
  version: '1.0.0',
  apiBaseUrl: '/api/v1',
  demoMode: false, // Set to false to point all services to Django REST API
  csrfHeader: 'X-CSRFToken',
  csrfCookieName: 'csrftoken'
};
```
No modifications to UI components or controllers are required.
