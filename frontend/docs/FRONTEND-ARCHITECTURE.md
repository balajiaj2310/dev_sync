# DevSync Frontend Architecture & Implementation Guide

## 1. Architectural Philosophy
The DevSync frontend is engineered as a clean, decoupled, high-performance web platform built on **Vanilla ES6+ JavaScript modules**, **HTML5 semantic templates**, and **Bootstrap 5 layout utilities**. It is structured to run seamlessly both as a static preview and as direct integration templates for a future **Django 5.x** backend.

---

## 2. Directory Structure

```
frontend/
├── docs/                      # Architectural, design, and API documentation
│   ├── DESIGN-SYSTEM.md
│   ├── FRONTEND-ARCHITECTURE.md
│   ├── PAGE-INVENTORY.md
│   └── API-INTEGRATION.md
├── public/                    # Static graphics, SVGs, and favicon
│   ├── favicon.svg
│   ├── images/
│   │   ├── logo.svg
│   │   ├── logo-icon.svg
│   │   ├── landing-illustration.svg
│   │   └── error-illustrations/ (401.svg - 500.svg)
│   └── fonts/
├── src/
│   ├── index.html             # Developer quick launcher & directory hub
│   ├── pages/                 # Full HTML views grouped by domain
│   │   ├── public/            # Landing, Explore, Pricing, Contact
│   │   ├── auth/              # Sign in, Sign up, Forgot, Reset
│   │   ├── dashboard/         # Activity overview & metrics
│   │   ├── repositories/      # Repositories, files, commits, branches
│   │   ├── pull-requests/     # PR list, detail, and creation
│   │   ├── issues/            # Issue tracker, create, and detail
│   │   ├── teams/             # Teams list, detail, members
│   │   ├── developers/        # Discover, profile, connections
│   │   ├── community/         # Discord-style channels and chat
│   │   ├── assistant/         # AI coding chat and diff assistant
│   │   ├── analytics/         # Chart.js velocity & code visualizations
│   │   ├── profile/           # Edit user profile & social links
│   │   ├── notifications/     # Notification feed & filter tabs
│   │   ├── settings/          # Account, Privacy, Preferences
│   │   └── errors/            # Custom 401, 403, 404, 405, 429, 500
│   ├── assets/
│   │   └── css/               # Modular CSS system
│   └── js/                    # Native ES6+ JavaScript modules
│       ├── config/            # Environment & endpoint configuration
│       ├── core/              # API client, DOM utils, toasts, formatters
│       ├── components/        # Header, sidebar, modals, dropdowns
│       ├── mock/              # Stateful demo data and MockAPI client
│       ├── services/          # Domain services (auth, repos, issues...)
│       ├── pages/             # Page controllers
│       └── main.js            # Global bootstrapper & page dispatcher
```

---

## 3. JavaScript Module System & Lifecycle

1. **Bootstrap Initialization (`main.js`)**:
   - Inspects `document.body.dataset.page` to identify the active view.
   - Dynamically mounts the global shared navigation components (`HeaderComponent` and `SidebarComponent`).
   - Dispatches the dedicated page controller (e.g., `initRepositoriesPage()`, `initCommunityPage()`).

2. **Decoupled API Layer (`core/api-client.js`)**:
   - Checks `APP_CONFIG.demoMode`.
   - When `demoMode: true`, calls are routed transparently to `MockAPI`, providing stateful, reactive CRUD mutations in memory with local storage fallback.
   - When `demoMode: false`, standard `window.fetch` calls are executed against the Django backend with automatic CSRF token injection and bearer authorization headers.

---

## 4. State Management & Mock Engine
The mock database (`mock/mock-data.js` and `mock/mock-api.js`) maintains state for:
- Repositories (creation, filtering, file browser hierarchy, commits, branches)
- Pull requests (review workflow, status tags, comments)
- Issues (label tagging, state changes)
- Developer connections (pending, accepted, mutual friends)
- Community channels (real-time message appending, channel switching)
- AI assistant conversations (streaming-simulated LLM responses with code blocks)
- User profile, settings, and notifications.

---

## 5. Django Backend Migration Readiness
All HTML templates are structured with semantic tags and named routes ready for Django template inheritance (`{% extends "base.html" %}`, `{% block content %}`, and `{% url '...' %}`).
Refer to `docs/API-INTEGRATION.md` for complete Django URL and view mappings.
