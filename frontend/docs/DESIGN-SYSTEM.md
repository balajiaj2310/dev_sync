# DevSync Design System Specification

## 1. Overview & Brand Identity
DevSync is an engineering collaboration platform blending **GitHub's** structural utility, **Instagram's** connection workflows, and **Discord's** real-time community experience. The visual language is clean, modern, high-contrast, and focused on clarity with a signature mint accent palette.

---

## 2. Color Palette & Tokens

All design tokens are formalized in `src/assets/css/tokens.css`.

| Token Name | Hex Value | Semantic Purpose |
|---|---|---|
| `--color-primary` | `#111111` | Primary text, primary CTA buttons, dark brand accents |
| `--color-mint` | `#A8F0D0` | Primary brand accent, selected states, highlights |
| `--color-mint-strong` | `#86E7BC` | Hover states, active borders, badges |
| `--color-mint-light` | `#E8FBF3` | Background tints, subtle pill badges, hover fills |
| `--color-surface` | `#FFFFFF` | Background of cards, dropdowns, modals, and tables |
| `--color-background` | `#F8FAF9` | Global canvas background |
| `--color-border` | `#D8DEDB` | Structural dividers, input borders, card outlines |
| `--color-border-subtle` | `#EAEFEA` | Secondary table lines, nested panels |
| `--color-text-muted` | `#6C757D` | Captions, secondary timestamps, subtitles |
| `--color-success` | `#21865B` | Green badge text, closed PRs, merged commits |
| `--color-danger` | `#C03939` | Destructive buttons, error alerts, closed issues |

---

## 3. Typography Hierarchy

Fonts loaded via Google Fonts CDN:
- **Display Headings**: `'Space Grotesk', sans-serif` (600, 700)
- **Interface & Body**: `'Inter', -apple-system, sans-serif` (400, 500, 600)
- **Code & Numbers**: `'JetBrains Mono', monospace` (400, 500)

### Type Scale
- **H1 (Hero Display)**: `2.25rem` (36px) · weight `700`
- **H2 (Section Header)**: `1.75rem` (28px) · weight `600`
- **H3 (Card Title)**: `1.25rem` (20px) · weight `600`
- **Body Regular**: `0.875rem` (14px) · line-height `1.5`
- **Caption / Meta**: `0.75rem` (12px) · weight `500`
- **Code / Sha**: `0.8125rem` (13px) · JetBrains Mono

---

## 4. Spacing, Elevation & Radii

### Border Radii
- Default Card / Button: `6px` (`--radius-md`)
- Badges / Avatars: `9999px` (`--radius-pill`)
- Modals / Popovers: `8px` (`--radius-lg`)

### Shadow Elevations
- **Subtle**: `0 1px 3px rgba(0, 0, 0, 0.05)`
- **Hover/Card**: `0 4px 12px rgba(0, 0, 0, 0.08)`
- **Modal**: `0 12px 32px rgba(0, 0, 0, 0.16)`

---

## 5. UI Component Catalog

1. **Buttons**:
   - `.btn-primary`: Solid `#111111` background with white text.
   - `.btn-secondary`: Light surface with `#D8DEDB` border and dark text.
   - `.btn-mint`: Brand accent button (`#A8F0D0` background, dark text).
   - `.btn-outline`: Crisp outline for secondary actions.
   - `.btn-ghost`: Borderless utility buttons with light background hover.
   - `.btn-danger`: Red destructive alert buttons.

2. **Badges**:
   - `.badge-mint`: Highlighting active filters, open counts, verified status.
   - `.badge-subtle`: Neutral tags for language labels and counts.
   - `.badge-success` / `.badge-danger`: For merged/open statuses.

3. **Cards & Tables**:
   - `.card`: White surface, subtle border, gentle padding.
   - `.data-table`: Striped hover, left-aligned typography, mono commit SHAs.

4. **Modals & Dialogs**:
   - Managed via native vanilla module `ModalManager` in `core/modal-manager.js`.
   - Accessible keyboard dismiss (`Esc`), backdrop click dismiss, clean animations.
