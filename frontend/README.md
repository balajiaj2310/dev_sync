# DevSync Frontend

DevSync is a modern developer collaboration platform engineered with **GitHub's** repository structure, **Instagram's** connection workflows, and **Discord's** real-time community engagement.

---

## 🚀 Quick Start

### 1. Static Execution
You can preview the platform immediately without any package installations:
- Open `frontend/src/index.html` in your web browser.
- Alternatively, launch a static server from the repository root:
```bash
# Python 3 built-in server
python -m http.server 3000

# Or using npx
npx serve frontend/src
```
Navigate to `http://localhost:3000/src/index.html`.

---

## 📂 Architecture & File Structure

```
frontend/
├── docs/                      # Full platform specifications
│   ├── DESIGN-SYSTEM.md       # Color tokens, typography, radii & icons
│   ├── FRONTEND-ARCHITECTURE.md# Component lifecycle, ES modules & state
│   ├── PAGE-INVENTORY.md      # Matrix of all 34 implemented pages
│   └── API-INTEGRATION.md     # Django URL & REST endpoint contracts
├── public/                    # Scalable SVGs, illustrations, favicon
├── src/
│   ├── index.html             # Central page launcher & directory
│   ├── pages/                 # Public, Auth, Dashboard, Repos, PRs, etc.
│   ├── assets/css/            # Tokens, reset, typography, layouts, components
│   └── js/                    # Native ES6+ modules & stateful Mock API
```

---

## 🎨 Design System
- **Colors**: Modern minimal dark `#111111` paired with signature mint accents (`#A8F0D0`, `#86E7BC`, `#E8FBF3`).
- **Typography**: Space Grotesk (headings), Inter (interface), and JetBrains Mono (code).
- **Icons**: Lucide SVG icons.
- **Charts**: Chart.js for developer velocity and activity graphs.

---

## 🔌 Backend Integration (Django Ready)
All interactive services (`auth-service`, `repository-service`, `pull-request-service`, `connection-service`, `community-service`, `assistant-service`) communicate through `core/api-client.js`.
To connect to the live Django backend:
1. Open `src/js/config/app-config.js`.
2. Toggle `demoMode: false`.
3. Ensure Django endpoints match the specifications in `docs/API-INTEGRATION.md`.
