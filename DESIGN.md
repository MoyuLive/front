# Yantube Front Design System

## 0. Research Log

- **Project state**: this is an extraction from an existing React/MUI interface; historical design research is unavailable.
- **Candidates considered**: MUI dark defaults match the existing admin and player surfaces; a media-first cinematic system would overstate the requested functional work; a dense dashboard system would make the viewer surface feel administrative.
- **Selection**: retain the existing MUI dark language and CSS-module player, using the frontend design router's default taste discipline. No external brand system is introduced because visual redesign is outside scope.
- **Evidence**: `src/main.tsx`, `src/pages/Home.tsx`, `src/pages/Room.tsx`, `src/pages/AdminRooms.tsx`, and `src/components/player/MoyuPlayer.module.scss` establish compact controls, restrained radii, bordered surfaces, and responsive stacks.

## 1. Atmosphere & Identity

Yantube is a focused live-viewing surface: dark, direct, and media-first, with administration remaining compact and legible. Its signature is a quiet video canvas surrounded by restrained operational metadata; status, privacy, and interaction are clear without competing with the stream.

## 2. Color

### Palette

The implementation uses MUI semantic palette roles rather than duplicating raw color values.

| Role | Token | Usage |
|---|---|---|
| Surface/primary | `background.default` | Page background |
| Surface/secondary | `background.paper` | Cards, dialogs, chat composer |
| Surface/media | `common.black` | Player and cover wells |
| Text/primary | `text.primary` | Headings and body |
| Text/secondary | `text.secondary` | Metadata and hints |
| Border/default | `divider` | Cards, dividers, outlined controls |
| Accent/primary | `primary.main` | Primary actions and focus |
| Status/live | `error.main` | Live status only |
| Status/success | `success.main` | Connected and successful states |
| Status/warning | `warning.main` | Privacy and caution states |
| Status/error | `error.main` | Errors and destructive actions |

### Rules

- Prefer MUI semantic colors in `sx`; CSS modules use CSS variables sourced from the theme-facing component where practical.
- Accent colors communicate state or action, never decoration.
- Existing raw media-well colors are accepted legacy usage; new viewer/chat work must not add unrelated raw colors.

## 3. Typography

### Scale

| Level | MUI variant | Usage |
|---|---|---|
| Page title | `h4` / responsive override | Viewer page and home title |
| Section title | `h5` | Admin sections |
| Panel title | `h6` | Cards, privacy and chat sections |
| Body | `body1` | Forms and primary copy |
| Secondary | `body2` | Metadata, viewer identity, timestamps |
| Caption | `caption` | Compact status labels |

### Font Stack

- Primary: MUI default system sans-serif stack.
- Mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` for stream codes only.

### Rules

- Visible body text remains at least 14px.
- Usernames and room titles wrap safely; credentials and URLs may break anywhere.
- Danmaku uses the body scale with readable contrast and a subtle text outline supplied by the overlay component.

## 4. Spacing & Layout

### Base Unit

All spacing uses MUI's 8px spacing step or its 4px half-step.

| Token | Value | Usage |
|---|---:|---|
| Compact | 4px | Icon alignment and dense metadata |
| Small | 8px | Inline groups |
| Standard | 16px | Card padding and form groups |
| Comfortable | 24px | Panel spacing |
| Section | 32px | Major page groups |

### Grid

- Maximum viewer width: MUI `xl` container.
- Viewer layout: player/chat side-by-side when space permits, single column below the MUI `md` breakpoint.
- Existing breakpoints remain authoritative: `xs`, `sm`, `md`, `lg`, `xl`.

### Rules

- No horizontal scroll at 375px.
- The video preserves 16:9; the chat composer remains reachable without covering player controls.
- Danmaku overlay is clipped to the player and ignores pointer events.

## 5. Components

### Planned Showcase Primitives

- **Account actions**: signed-out, signed-in, keyboard focus, logout pending.
- **Room access gate**: loading, login-required, password-required, incorrect-password, disabled submit, success.
- **Viewer count**: initial, connected, reconnecting, zero viewers.
- **Danmaku composer**: default, focus, disabled/disconnected, sending, validation error.
- **Danmaku overlay**: empty, one message, concurrent messages, reduced motion.
- **Privacy controls**: independent login/password switches, password entry, unchanged password, save loading/error/success.

### Implemented Reusable Patterns

Existing MUI `Alert`, `Button`, `Card`, `Chip`, `Dialog`, `Snackbar`, `Stack`, `Switch`, and `TextField` patterns remain canonical. New reusable patterns used in multiple pages must be documented here after implementation.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 120ms | ease-out | Hover and pressed feedback |
| Standard | 240ms | ease-in-out | Access state and panel transitions |
| Danmaku | 8-12s | linear | Right-to-left message travel |

- Animate only `transform` and `opacity`.
- `prefers-reduced-motion` replaces scrolling danmaku with a static overlay that remains for six seconds.
- Every control must retain MUI's visible keyboard focus state.

## 7. Depth & Surface

**Strategy: borders-only.** Cards and panels use `divider` outlines and subtle MUI tonal differences. No new decorative shadows or glow effects are introduced. Dialog elevation remains the framework default because it represents a true modal layer.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.1 AA for changed viewer, account, chat, and privacy surfaces.
- Text and controls meet AA contrast; focus indicators remain visible.
- Access errors use `Alert`; viewer count uses an appropriate live region without announcing every danmaku message.
- Forms have explicit labels, and chat submission works with keyboard and button activation.
- Danmaku is supplementary: messages remain available in an accessible recent-message region while animated copies are `aria-hidden`.
- Reduced-motion behavior is mandatory.

### Accepted Debt

No new accessibility debt is accepted. Existing untranslated English player labels and legacy raw color values are outside this feature's scope.
