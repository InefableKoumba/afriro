# Drumcello Design System — Baseline Guide

> Distilled from the Drumcello app. Use this as the single source of truth when building the next project. Extend it; never silently deviate from it.

---

## 1. Brand Principles

The Drumcello aesthetic fuses **warmth** (cello, resonance, wood) with **precision** (percussion, rhythm, timing). The two failure modes to avoid at all costs:

- A generic cold dark-mode (pure black, cold grey, condensed sans, icy blue accents)
- Over-decoration to compensate for "minimalism" (excessive gradients, multi-accent screens, heavy iconography)

**Design must feel precise but warm, never clinical, never decorative.**

---

## 2. Color System

### Design Philosophy

Backgrounds are warm near-blacks, **never pure `#000000` and never pure `#FFFFFF`**. The single signature accent color is **Copper (`#D8804A`)** — it is both energetic and organic, bridging digital and acoustic worlds. A secondary accent exists for video/media contexts.

### 2a. Dark Mode Tokens (Primary)

| Token | Hex / Value | Role |
|---|---|---|
| `color.bg.base` | `#0A0A0A` | Default screen background |
| `color.bg.deep` | `#000000` | Video player, deep-focus screens |
| `color.bg.surface` | `#121212` | Cards, sheets, input fields, mini-player |
| `color.bg.surface.raised` | `#181818` | Modals, popovers atop a surface |
| `color.bg.surface.highlight` | `#242424` | Hover state, active list row |
| `color.bg.surface.elevated` | `#2A2A2A` | Floating toolbars, dropdowns |
| `color.accent.primary` | `#D8804A` | Copper — primary CTA, active states, scrubber fill |
| `color.accent.bright` | `#F0A46E` | Copper highlight — thumb, pressed/hover states |
| `color.accent.dim` | `#A85A28` | Copper deep — gradient terminus, shadow tint |
| `color.accent.translucent` | `rgba(216,128,74,0.15)` | Chip fills, subtle accent backgrounds |
| `color.accent.glow` | `rgba(216,128,74,0.35)` | Button outer glow, active-icon glow |
| `color.accent.video` | `#3FA894` | Teal — video mode scrubber, video active states |
| `color.accent.video.dim` | `#1C6E62` | Teal deep — video gradient |
| `color.text.primary` | `#FFFFFF` | Titles, primary labels |
| `color.text.secondary` | `#B3B3B3` | Metadata, subtitles, timestamps |
| `color.text.muted` | `#717171` | Disabled, placeholders, inactive icons |
| `color.text.subtle` | `#525252` | Fine print, ghost text |
| `color.border.hairline` | `rgba(255,255,255,0.08)` | Card outlines, dividers |
| `color.border.subtle` | `rgba(255,255,255,0.12)` | Focused inputs, elevated borders |
| `color.border.medium` | `rgba(255,255,255,0.18)` | Strong container outlines |
| `color.border.strong` | `#282828` | Opaque separators |
| `color.status.success` | `#22C55E` | Success states |
| `color.status.error` | `#EF4444` | Destructive / error states |
| `color.status.warning` | `#F59E0B` | Warnings |
| `color.status.info` | `#3B82F6` | Informational |

### 2b. Light Mode Tokens

Light mode uses warm off-whites and warm tans — **never pure white pages or cold greys**. The copper accent becomes slightly deeper to maintain contrast.

| Token | Hex / Value | Role |
|---|---|---|
| `color.bg.base` | `#FAF7F4` | Default screen background |
| `color.bg.deep` | `#F0EBE4` | Subdued page sections, sidebars |
| `color.bg.surface` | `#FFFFFF` | Cards, sheets, input fields |
| `color.bg.surface.raised` | `#F5F0EB` | Modals, popovers (slightly warm) |
| `color.bg.surface.highlight` | `#EDE8E2` | Hover state, active list row |
| `color.bg.surface.elevated` | `#E8E1DA` | Floating toolbars, dropdowns |
| `color.accent.primary` | `#C06A32` | Copper (deepened for contrast on light) |
| `color.accent.bright` | `#D8804A` | Copper highlight — same as dark primary |
| `color.accent.dim` | `#8A4820` | Copper deep — gradient terminus |
| `color.accent.translucent` | `rgba(192,106,50,0.10)` | Chip fills, subtle accent backgrounds |
| `color.accent.glow` | `rgba(192,106,50,0.25)` | Button shadow, active glow |
| `color.accent.video` | `#287A6C` | Teal (deepened for light) |
| `color.accent.video.dim` | `#1A5549` | Teal deep — gradient on light |
| `color.text.primary` | `#1A1612` | Titles, primary labels (warm near-black) |
| `color.text.secondary` | `#5C5046` | Metadata, subtitles, timestamps |
| `color.text.muted` | `#9C8E82` | Disabled, placeholders, inactive icons |
| `color.text.subtle` | `#C0B4A8` | Fine print, ghost text |
| `color.border.hairline` | `rgba(26,22,18,0.08)` | Card outlines, dividers |
| `color.border.subtle` | `rgba(26,22,18,0.12)` | Focused inputs |
| `color.border.medium` | `rgba(26,22,18,0.18)` | Strong container outlines |
| `color.border.strong` | `#D8D0C8` | Opaque separators |
| `color.status.success` | `#15803D` | Success states |
| `color.status.error` | `#DC2626` | Destructive / error states |
| `color.status.warning` | `#D97706` | Warnings |
| `color.status.info` | `#2563EB` | Informational |

### Color Rules (apply to both modes)

- **One accent at a time.** Never mix copper and teal as co-equals on a single screen. Copper is dominant for audio/neutral context; teal is dominant for video context.
- **One solid-fill accent element per screen maximum.** Usually the primary action button. Everything else uses accent as outline, text color, or thin fill — never stack multiple solid-accent buttons.
- **No pure `#000000` or `#FFFFFF` in either mode.** Near-black and near-white only.
- **Never convey state through color alone** — pair with icon change, position, or weight change.
- Album/video artwork may contribute a subtle 5-10% opacity extracted-hue wash on backgrounds. This is the only allowed gradient source beyond the defined accent ramps.

---

## 3. Typography

Two typeface families, each with a single, distinct job. **Do not introduce a third.**

| Role | Family | Used for |
|---|---|---|
| `font.display` | **Fraunces** (warm serif, variable) | Track/video titles, screen H1s, empty states, hero moments |
| `font.ui` | **Inter** (geometric sans) | All chrome — labels, buttons, metadata, list rows, navigation |

### Type Scale

| Token | Size | Weight | Family | Use |
|---|---|---|---|---|
| `type.display.xl` | 32px | 500 | display | Splash / onboarding hero |
| `type.display.lg` | 28px | 500 | display | Now Playing title, screen H1 |
| `type.display.md` | 22px | 500 | display | Album/Artist/Playlist header |
| `type.body` | 15px | 400 | ui | Standard list rows, descriptions |
| `type.label` | 13px | 400 | ui | Metadata, secondary text, timestamps |
| `type.caption` | 11px | 400 | ui | Tags, badges, fine print |

### Typography Rules

- **Sentence case everywhere.** Never Title Case or ALL CAPS, including buttons and tab labels.
- **No bold/700 weights.** The system uses 400 and 500 only. Hierarchy is established through size and color, not weight.
- **Line height:** 1.4 minimum for body/label text; 1.2 for display.
- **Letter-spacing:** Standard tracking only. Never condense or tighten `font.ui`. Display font may use very slightly tighter tracking (-0.01em) at large sizes only.
- `font.display` **never appears in dense lists** (library rows, queue). Reserve it for hero/header contexts where a title has room to breathe.

---

## 4. Spacing

8px base unit. All values are multiples of 4.

| Token | Value | Use |
|---|---|---|
| `space.xs` | 4px | Icon-to-label gaps, tight inline pairs |
| `space.sm` | 8px | Tight internal padding, icon margins |
| `space.md` | 16px | Standard card/list padding, gaps between elements |
| `space.lg` | 24px | Section spacing, screen horizontal margins |
| `space.xl` | 32px | Hero spacing (artwork to controls) |
| `space.xxl` | 48px | Major section breaks, empty-state vertical centering |

### Spacing Rules

- Screen horizontal margin is **always 20-24px** (use `space.lg`), consistent across all screens.
- Elements must **never touch a screen edge** or each other with less than `space.sm`.
- Full-bleed content (artwork, video) is the only exception to horizontal margins.

---

## 5. Shape & Radius

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 6px | Badges, small utility elements |
| `radius.chip` | 10px | Input fields, filter chips, tags |
| `radius.card` | 16px | Cards, artwork thumbnails, modals |
| `radius.modal` | 24px | Large bottom sheets, full-panel modals |
| `radius.pill` | 9999px | Buttons, toggles, pill-shaped tags |

**Never mix radius values within the same component type on a single screen.**

---

## 6. Elevation & Depth

Elevation is communicated through **surface contrast and hairline borders only** — no drop shadows, no box-shadow heavy stacking.

| Level | Background | Border | Blur | Use |
|---|---|---|---|---|
| 0 - Base | `bg.base` | — | — | Screen background |
| 1 - Surface | `bg.surface` | `border.hairline` | — | Cards, list containers, mini-player |
| 2 - Raised | `bg.surface.raised` | `border.subtle` | — | Modals, popovers |
| 3 - Sheet | `bg.surface` @ 80% opacity | `border.subtle` | 20px backdrop blur | Bottom sheets, frosted overlays |
| 4 - Floating | `bg.surface.elevated` | `border.medium` | — | Floating toolbars, tooltips |

---

## 7. Iconography

- **Thin-line style only**, consistent **1.5px stroke weight** (Tabler-outline equivalent).
- **No filled icons** except: play/pause glyphs inside solid buttons, and the active tab-bar icon.
- Standard sizes: **16px** inline with text, **20px** tab bar / toolbar, **24px** max for decorative use.
- Never mix icon styles (no rounded + sharp, no mixing outline and filled sets in the same screen).

---

## 8. Component Patterns

### Buttons

| Variant | Fill | Border | Radius | Notes |
|---|---|---|---|---|
| Primary | Solid `accent.primary` | None | Pill or circle | Icon-only or icon+label. Max one per screen. |
| Secondary | Transparent | 1px `accent.primary` or `border.hairline` | `radius.chip` | For secondary actions |
| Ghost | None | None | — | Tertiary actions (shuffle, repeat, more) |

On hover/press, Primary button gains an outer glow: `color.accent.glow`, ~12px spread.

### Cards

- Fill: `bg.surface`, `radius.card`, **no drop shadow** — depth comes from hairline border + background contrast.
- Artwork leads. Text is secondary; never overlay text directly on unprocessed artwork — add a scrim when text must sit on an image.
- On hover: scale 1.02x, border transitions to `border.subtle`.

### List Rows (library, queue)

- Fixed **44px artwork thumbnail**, `radius.sm` (6px).
- Title: `type.body` / `color.text.primary`. Subtitle: `type.label` / `color.text.secondary`.
- Row height: **60-68px minimum** — never cramped.
- Separator: `border.hairline`, 1px.

### Input Fields

- Fill: `bg.surface`. Border: 1px `border.hairline` at rest; transitions to 1px `border.subtle` on focus.
- Radius: `radius.chip`.
- Placeholder in `color.text.muted`.

### Bottom Sheets

- 80% opacity `bg.surface` + 20px backdrop blur over the current screen's artwork — not opaque black.
- Drag handle at top, 16px content padding, single primary heading in `type.display.md`.

### Mini-Player

- Persistent, docked above tab bar once playback starts.
- 60px height, `bg.surface`, thumbnail + title + single play/pause only. No scrubber.

### Scrubber / Progress

- 3px track height. Fill: `accent.primary` for audio mode, `accent.video` for video mode.
- Thumb visible only on active interaction or playback state.

### Tab Bar

- 4 items maximum. Active icon: `accent.primary`. Inactive: `color.text.muted`.
- Text labels optional — icon-only preferred if glyphs are recognizable.

### Chips / Tags

- Background: `accent.translucent`. Border: 1px `border.hairline`. Radius: `radius.pill`.
- Active chip: solid `accent.primary` fill, white/primary text.

---

## 9. Motion

- **Spring-based transitions, ~300ms**, slight overshoot on play/pause and mini-player -> full-player expansion.
- Screen transitions: slide or fade — **never a hard cut**.
- The scrubber/waveform is the **only element allowed continuous idle animation** (reactive to playback). Nothing else animates passively.
- **Always respect `prefers-reduced-motion`** — fall back to simple opacity fades (150ms, no spring).

---

## 10. Mode Signaling (Audio vs. Video)

**Color communicates mode before any label does** — this is the core UX principle.

| Context | Accent | Background | Display type |
|---|---|---|---|
| Audio | Copper `#D8804A` | Warm base `#0A0A0A` | `font.display` serif for title |
| Video | Teal `#3FA894` | Deep `#000000` | `font.ui` sans; chrome auto-hides during playback |
| Neutral (Search, Settings, Library) | Copper default | Warm base | Per screen-specific H1 |

Mixed results (e.g., Search showing songs + videos) -> use neutral `color.text.secondary` for chrome; let each result's thumbnail/badge carry copper or teal.

---

## 11. Light Mode — Specific Guidance

When implementing light mode:

- Swap backgrounds to warm off-whites (`#FAF7F4` base). The hierarchy of surfaces still holds — just inverted in luminance.
- Deepen the copper to `#C06A32` for sufficient contrast on light backgrounds (the bright copper `#F0A46E` becomes a tint/highlight, not the main accent).
- Hairline borders flip to **rgba of near-black** instead of near-white.
- `font.display` feels more at home in light mode — lean into it for hero contexts.
- Bottom sheet blur remains the same technique (backdrop-filter), just on a light translucent base.
- Avoid flat white surfaces stacked on top of flat white backgrounds — always keep at least 1 level of surface contrast.

### CSS Implementation Pattern

```css
:root {
  /* Dark mode (default) */
  --color-bg-base: #0A0A0A;
  --color-bg-surface: #121212;
  --color-bg-surface-raised: #181818;
  --color-accent-primary: #D8804A;
  --color-accent-bright: #F0A46E;
  --color-accent-dim: #A85A28;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-text-muted: #717171;
  --color-border-hairline: rgba(255, 255, 255, 0.08);
  --color-border-subtle: rgba(255, 255, 255, 0.12);
}

@media (prefers-color-scheme: light) {
  :root {
    --color-bg-base: #FAF7F4;
    --color-bg-surface: #FFFFFF;
    --color-bg-surface-raised: #F5F0EB;
    --color-accent-primary: #C06A32;
    --color-accent-bright: #D8804A;
    --color-accent-dim: #8A4820;
    --color-text-primary: #1A1612;
    --color-text-secondary: #5C5046;
    --color-text-muted: #9C8E82;
    --color-border-hairline: rgba(26, 22, 18, 0.08);
    --color-border-subtle: rgba(26, 22, 18, 0.12);
  }
}
```

### React Native / TypeScript Pattern

```ts
import { useColorScheme } from 'react-native';

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme !== 'light';

  return {
    bg: {
      base:          dark ? '#0A0A0A'  : '#FAF7F4',
      surface:       dark ? '#121212'  : '#FFFFFF',
      surfaceRaised: dark ? '#181818'  : '#F5F0EB',
    },
    accent: {
      primary:       dark ? '#D8804A'  : '#C06A32',
      bright:        dark ? '#F0A46E'  : '#D8804A',
      dim:           dark ? '#A85A28'  : '#8A4820',
      translucent:   dark ? 'rgba(216,128,74,0.15)' : 'rgba(192,106,50,0.10)',
    },
    text: {
      primary:       dark ? '#FFFFFF'  : '#1A1612',
      secondary:     dark ? '#B3B3B3'  : '#5C5046',
      muted:         dark ? '#717171'  : '#9C8E82',
    },
    border: {
      hairline:      dark ? 'rgba(255,255,255,0.08)' : 'rgba(26,22,18,0.08)',
      subtle:        dark ? 'rgba(255,255,255,0.12)' : 'rgba(26,22,18,0.12)',
    },
  };
}
```

---

## 12. Accessibility Baseline

- **Text contrast:** `color.text.primary` on `color.bg.base` and `color.bg.surface` must meet WCAG AA (4.5:1) minimum. Verify whenever introducing new background tints.
- **Tap targets minimum 44x44px** regardless of visual icon size.
- **State must never be communicated by color alone** — pair with icon change, position change, or font weight shift.
- All interactive elements must have accessible labels (`aria-label` / `accessibilityLabel`).
- Respect `prefers-reduced-motion` — always provide a non-spring fallback.

---

## 13. Anti-Patterns — Do Not Build These

| Anti-Pattern | Instead |
|---|---|
| Pure black `#000000` backgrounds in standard UI | `#0A0A0A` warm near-black |
| Pure white `#FFFFFF` text or backgrounds in light mode | Off-white `#FAF7F4`, near-black `#1A1612` |
| Font weights 600, 700, 800 anywhere | 400 (body) and 500 (display) only |
| More than two accent colors on one screen | One primary accent, one mode accent — never co-equal |
| Multiple solid-fill accent buttons on one screen | One primary CTA max; rest are secondary/ghost |
| Drop shadows for elevation | Surface contrast + hairline borders |
| ALL CAPS or Title Case labels | Sentence case everywhere |
| Condensed or ultra-tight letter-spacing on `font.ui` | Standard tracking only |
| Gradients beyond copper/teal ramps and art-extracted washes | Stick to the defined accent ramps |
| Third typeface or display font in dense list rows | `font.display` in hero contexts only |
| Icon-only buttons with ambiguous glyphs | Recognizable single-concept glyphs only |

---

## 14. Screen Inventory (Reference)

When designing a new screen, reuse existing tokens first. Extend only when truly necessary.

**Drumcello screens:** Splash · Library Home (Songs / Albums / Artists / Videos tabs) · Now Playing (audio) · Video Player · Album Detail · Playlist Detail · Artist Detail · Search · Folder Browser · Queue / Up Next (bottom sheet) · Now Playing Extras (EQ, sleep timer, speed - bottom sheet) · Settings

When generating a new screen **not listed above**, reuse existing color, type, and spacing tokens before introducing anything new.

---

## 15. Font Loading (Web)

```html
<!-- Google Fonts — preconnect first for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

```css
body {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.display {
  font-family: 'Fraunces', serif;
  font-weight: 500;
}
```

---

*Last updated from Drumcello source: `src/constants/theme.ts`, `src/global.css`, `DESIGN.md`, `design-guide.md`.*
