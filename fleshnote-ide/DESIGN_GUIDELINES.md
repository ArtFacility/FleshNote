# FleshNote IDE — Design Guidelines

Reference for building new components and pages that feel native to FleshNote.

---

## 1. Philosophy

FleshNote is a **dark, utilitarian writing IDE** with a literary-gothic atmosphere. Think IDE meets medieval scriptorium: functional density, typographic hierarchy, and restrained warmth through amber accents. Every surface is flat, sharp-cornered, and low-contrast — ornamentation is earned through color and typography, never through geometry.

**Core principles:**
- **Hard edges everywhere.** No `border-radius` on functional elements (buttons, cards, inputs, panels, badges, toasts, menus). The only exception is the settings modal (`border-radius: 8px`) and notification badge pills (`border-radius: 8px`).
- **Dark mode only.** There is no light theme. Background layers are near-black with subtle grey differentiation.
- **Amber is the brand color.** It is the single warm accent in a cool-grey palette. Use it for primary actions, active states, branding text, and highlights — never for large filled areas beyond buttons.
- **Density over whitespace.** Panels are compact. Padding is tight (12–16px). The UI respects that writers want maximum editor space.

---

## 2. Color Palette

All colors are defined as CSS custom properties on `:root`. **Always** use the variable, never a raw hex.

### Backgrounds (darkest → lightest)
| Variable | Hex | Usage |
|---|---|---|
| `--bg-deep` | `#0d0e11` | Root/body background, editor canvas, deepest inputs |
| `--bg-base` | `#131519` | Panels, sidebars, toolbars, title bar |
| `--bg-surface` | `#1a1c22` | Cards, form fields, list items (resting) |
| `--bg-elevated` | `#22252d` | Hover cards, tooltips, dropdowns, active tabs |
| `--bg-hover` | `#2a2d37` | Hovered list items, hovered buttons |

### Borders
| Variable | Hex | Usage |
|---|---|---|
| `--border-subtle` | `#2a2d37` | Internal dividers, panel edges, input borders (resting) |
| `--border-default` | `#353842` | Outer card borders, stronger emphasis, focus rings (non-amber) |

### Text
| Variable | Hex | Usage |
|---|---|---|
| `--text-primary` | `#e8e6e1` | Headings, body prose, active UI labels |
| `--text-secondary` | `#9b978f` | Descriptions, supporting text, hovered icons |
| `--text-tertiary` | `#6b6860` | Hints, placeholders, disabled text, metadata, shortcut labels |

### Accent Colors
| Variable | Hex | Role |
|---|---|---|
| `--accent-amber` | `#d4a052` | **Primary accent.** Active states, primary buttons, brand, highlights |
| `--accent-amber-dim` | `#d4a05233` | Amber background tints (active badges, selected items) |
| `--accent-amber-hover` | `#e0b06a` | Hovered amber buttons |
| `--accent-red` | `#c45c5c` | Danger, delete, destructive, secret/redacted |
| `--accent-red-dim` | `#c45c5c22` | Red background tint |
| `--accent-green` | `#5c9e6e` | Success, approve, completed, save confirmations |
| `--accent-green-dim` | `#5c9e6e22` | Green background tint |
| `--accent-blue` | `#5c8ec4` | Informational, lore entities, navigational arrows |
| `--accent-blue-dim` | `#5c8ec422` | Blue background tint |
| `--accent-purple` | `#8b6ec4` | Suggestions, quicknotes |
| `--accent-purple-dim` | `#8b6ec422` | Purple background tint |

### Entity Colors (semantic, for story entities)
| Variable | Hex | Entity |
|---|---|---|
| `--entity-character` | `#d4a052` | Characters (same as amber) |
| `--entity-item` / `--entity-lore` | `#6392c5` / `#5d8fc5` | Items and lore entries |
| `--entity-location` | `#5c9e6e` | Locations |
| `--entity-quicknote` | `#8b6ec4` | Quick notes |

---

## 3. Typography

### Font Stack
| Variable | Family | Role |
|---|---|---|
| `--font-mono` | `JetBrains Mono` | UI chrome: labels, badges, status bars, buttons, metadata, code |
| `--font-sans` | `Inter` | Headings, entity names, card titles, settings labels |
| `--font-serif` | `Crimson Pro` | Body prose in the editor, bios, snippets, quoted text |
| `--font-runes` | `Noto Sans Old Hungarian` | Decorative only (title animation on home screen) |

**Dyslexia mode** overrides all three main stacks with `OpenDyslexic`. Use the CSS variables, not font names directly, so this override works automatically.

### Typographic Conventions
- **UI chrome labels** (section headers, toolbar labels, tab labels, badge text):
  `font-family: var(--font-mono)`, `font-size: 9–11px`, `text-transform: uppercase`, `letter-spacing: 1–2px`, `color: var(--text-tertiary)`
- **Section titles / Card headings**: `font-family: var(--font-sans)`, `font-size: 14–22px`, `font-weight: 600`, `color: var(--text-primary)`
- **Body / prose text**: `font-family: var(--font-serif)`, `font-size: 15–18px`, `line-height: 1.65–1.8`, `color: var(--text-primary)`, `opacity: 0.92`
- **Metadata / stats**: `font-family: var(--font-mono)`, `font-size: 10–11px`, `color: var(--text-tertiary)`
- **Hints and subtitles**: `font-size: 11–13px`, `color: var(--text-secondary)`, `line-height: 1.4–1.6`

---

## 4. Spacing & Layout

### Panel Structure
The app uses a three-column flexbox layout:
- **Left panel** (320px): Chapter list, navigation
- **Middle panel** (flex: 1): Editor canvas
- **Right panel** (300px): Inspector, inbox, entity details

Panels collapse to `width: 0; min-width: 0` with a `0.3s ease` transition.

### Spacing Scale
Use multiples of 4px. Common values:
- `4px` — gap between tight inline elements (badge groups, button rows)
- `6–8px` — inner padding for small elements (badges, tags, chips)
- `10–12px` — list item padding, card inner padding
- `16px` — standard panel padding, field spacing, section gaps
- `20–24px` — section margins, larger card padding
- `32–40px` — major section separators, modal padding, editor area padding

### Toolbar Heights
| Element | Height |
|---|---|
| Title bar | 38px |
| Progress bar | 32px |
| Editor toolbar | ~36px (8px padding) |
| Format toolbar | ~36px (4px padding) |
| Status bar | 24px |
| IDE header toolbar | 36px |

---

## 5. Components

### Buttons

**Primary (CTA):**
```css
background: var(--accent-amber);
color: var(--bg-deep);
border: none;
font-family: var(--font-mono);
font-size: 12px;
text-transform: uppercase;
letter-spacing: 1–2px;
font-weight: 600;
padding: 12px;
/* hover: */ background: var(--accent-amber-hover);
/* disabled: */ opacity: 0.5; cursor: not-allowed;
```

**Secondary / Ghost:**
```css
background: var(--bg-elevated); /* or none */
color: var(--text-primary); /* or --text-tertiary */
border: 1px solid var(--border-subtle);
/* hover: */ border-color: var(--border-default);
```

**Icon buttons** (titlebar, toolbar):
```css
width: 28px; height: 28px;
background: none;
border: none;
color: var(--text-tertiary);
/* hover: */ color: var(--text-secondary); background: var(--bg-elevated);
```

**Active toggle button:**
```css
color: var(--accent-amber);
border-color: var(--accent-amber);
background: var(--accent-amber-dim);
```

**Danger items:** Use `color: var(--accent-red)` and `background: var(--accent-red-dim)` on hover.

**Dashed "add" buttons:**
```css
border: 1px dashed var(--border-subtle);
color: var(--text-tertiary);
/* hover: */ border-color: var(--accent-amber); color: var(--accent-amber);
```

### Cards
```css
background: var(--bg-surface);
border: 1px solid var(--border-subtle);
padding: 12–16px;
/* hover: */ border-color: var(--border-default);
```
For selected/active cards, add `border-color: var(--accent-amber)` and `background: var(--accent-amber-dim)`.

An accent stripe (top or inline-start) is a common pattern:
```css
border-top: 2px solid var(--accent-amber); /* or entity color */
/* or */ border-inline-start: 2px solid var(--accent-amber);
```

### Badges / Tags / Chips
```css
font-family: var(--font-mono);
font-size: 9px;
text-transform: uppercase;
letter-spacing: 0.5–1.5px;
padding: 2px 6px;
/* colored by type: */
color: var(--entity-character); background: var(--accent-amber-dim);
```
No border-radius. Use type-specific accent colors for entity badges.

### Form Inputs
```css
background: var(--bg-surface); /* or --bg-deep for deeper nesting */
border: 1px solid var(--border-subtle);
color: var(--text-primary);
font-family: var(--font-sans); /* or --font-mono for small selects */
font-size: 12px;
padding: 7–8px 10px;
outline: none;
/* focus: */ border-color: var(--accent-amber);
```
No border-radius. Placeholders use `var(--text-tertiary)` and `font-style: italic`.

### Textareas
Same as inputs but add:
```css
resize: vertical;
min-height: 48px;
line-height: 1.5;
```

### Selects (custom)
```css
appearance: none;
background-image: url("data:image/svg+xml,..."); /* chevron icon */
padding-right: 24px;
```

### Context Menus / Dropdowns
```css
background: var(--bg-elevated);
border: 1px solid var(--border-default);
padding: 4px 0;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
min-width: 220px;
```
Menu items: `padding: 8px 14px`, `font-size: 12px`, `color: var(--text-secondary)`.
Shortcut labels: `font-family: var(--font-mono)`, `font-size: 10px`, `color: var(--text-tertiary)`.
Section headers: `font-family: var(--font-mono)`, `font-size: 9px`, `uppercase`, `letter-spacing: 1.5px`.

### Popups / Modals
**Overlay:** `background: rgba(0, 0, 0, 0.3)` (or `rgba(13, 14, 17, 0.92)` with `backdrop-filter: blur(8px)` for full-screen overlays)

**Panel:**
```css
background: var(--bg-base);
border: 1px solid var(--border-default);
box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
width: 320px; /* or 380px for wide */
```
Popup headers use amber-colored mono text, uppercase.

### Tabs
```css
font-family: var(--font-mono);
font-size: 10px;
text-transform: uppercase;
letter-spacing: 1px;
color: var(--text-tertiary);
border-bottom: 2px solid transparent;
/* active: */ color: var(--accent-amber); border-bottom-color: var(--accent-amber);
```

### Toast Notifications
```css
background: var(--bg-elevated);
border: 1px solid var(--border-default);
padding: 10px 16px;
font-family: var(--font-mono);
font-size: 11px;
color: var(--text-secondary);
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
```
Slide in from right with a 0.2s ease animation.

### Empty States
Center-aligned, with:
- Icon at `font-size: 24px`, `opacity: 0.5`
- Text in `font-family: var(--font-mono)`, `font-size: 11px`, `color: var(--text-tertiary)`

### Scrollbars
```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-subtle); }
::-webkit-scrollbar-thumb:hover { background: var(--border-default); }
```

---

## 6. Animation

Animations are **fast, subtle, and functional** — no bounces or elastic easing.

| Pattern | Duration | Easing | Notes |
|---|---|---|---|
| Hover transitions | `0.15s` | `ease` | Color, border, background changes |
| Panel collapse/expand | `0.3s` | `ease` | Width/min-width transitions |
| Popup appear | `0.12–0.15s` | `ease` | Scale from 0.95–0.96 + fade |
| Card slide-in | `0.4s` | `ease` | translateY(16px) + fade, with 0.1s delay |
| Toast slide | `0.2s` | `ease` | translateX(20px) + fade |
| Context menu | `0.1s` | `ease` | Scale from 0.95 + fade |
| Hover card | `0.12s` | `ease` | translateY(4px) + fade |
| Pulse (status dot, writing) | `2s` | `ease infinite` | Opacity 1→0.4→1 |

**No `border-radius` animations.** No spring/bounce physics. No transform-origin tricks.

---

## 7. Shadows

Shadows are deep and cool-toned (pure black alpha):

| Context | Shadow |
|---|---|
| Dropdown / context menu | `0 8px 32px rgba(0, 0, 0, 0.5)` |
| Popup panel | `0 12px 48px rgba(0, 0, 0, 0.6)` |
| Toast | `0 4px 16px rgba(0, 0, 0, 0.4)` |
| Hover card (focus mode) | `0 4px 12px rgba(0, 0, 0, 0.2)` |
| Settings modal | `0 10px 30px rgba(0, 0, 0, 0.5)` |

No colored glows or `box-shadow` with accent colors — except the decorative rune particles which use `text-shadow: 0 0 12px currentColor` with `mix-blend-mode: screen`.

---

## 8. Icons

- Inline SVG, `stroke="currentColor"`, `strokeWidth="2"`, `fill="none"`
- Standard size: `width="16" height="16"` (or `14` for compact areas)
- Icon color inherits from parent text color (uses `currentColor`)
- Icons in buttons/menu items are paired with text via flexbox `gap: 6–10px`

No icon library is used — all icons are hand-coded inline SVGs defined as React components.

---

## 9. Internationalization (i18n)

- All user-facing strings go through `useTranslation()` from `react-i18next`
- Use logical properties for layout: `inset-inline-start`, `inset-inline-end`, `margin-inline-start`, `border-inline-start`, `padding-inline-end`, etc.
- The title bar forces `direction: ltr` for the logo (brand text should not flip in RTL)
- Never use `left`/`right` in CSS for layout — use `inline-start`/`inline-end`. Exception: absolute submenu positioning uses `left`/`right` with a `.submenu-left` override class

---

## 10. Patterns & Anti-Patterns

### Do
- Use CSS custom properties for all colors
- Keep `border-radius: 0` (square corners) on all functional UI
- Use `var(--font-mono)` + uppercase + letter-spacing for UI chrome labels
- Use `var(--font-serif)` for any prose or narrative content
- Use amber for primary/active states, keep other accents for semantic entity types
- Use dim variants (`--accent-*-dim`) for tinted backgrounds on active/selected states
- Use `transition: all 0.15s` for interactive hover effects
- Use 1px solid borders, never 2px+ except for accent stripes (border-inline-start, border-top)
- Separate sections with `border-bottom: 1px solid var(--border-subtle)` (hairline dividers)

### Don't
- Add `border-radius` to buttons, cards, inputs, menus, badges, or panels
- Use colored box-shadows or glowing effects
- Use gradients on backgrounds (only exception: the frequency bar fill uses a subtle linear-gradient)
- Use opacity below 0.4 for visible UI (disabled state is 0.3–0.5)
- Use white (`#fff`) — the lightest text is `--text-primary` (`#e8e6e1`)
- Use `font-weight: bold` on mono text — use `font-weight: 600–700`
- Add padding above 40px on any element except full-screen overlays
- Create complex multi-layered shadows — one shadow per element maximum
- Use CSS Grid for component internals (use flexbox) — Grid is acceptable for gallery/tile layouts like `.focus-modes-grid`
