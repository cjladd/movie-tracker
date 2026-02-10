# UI Overhaul Plan — Movie Night Planner

## Vision
**Dark cinema aesthetic + colorful/playful accents.** Neon purple (`#a855f7`) and cyan (`#06b6d4`) as primary accent colors on deep dark backgrounds. Rich animations, glowing elements, and a cohesive design system across every page.

---

## Phase 1: Design System & Shared Components

### 1.1 Update Design Tokens (`css/tokens.css`)
- [x] Tokens already exist — refine and extend:
  - Add **light mode** token overrides (`[data-theme="light"]`) for dark/light toggle
  - Add `--glow-amber`, `--glow-emerald` glow shadows for variety
  - Add `--transition-bounce` for playful micro-interactions
  - Add `--font-display` for headings (e.g., `'Poppins'` or `'Outfit'` — bolder, more cinematic)

### 1.2 Dark/Light Mode Toggle
- Add a `<button>` in the shared nav (sun/moon icon)
- Toggle `data-theme="light"` on `<html>`
- Persist preference in `localStorage`
- Light mode: swap `--bg-base` → `#f8fafc`, `--text-primary` → `#0f172a`, etc.
- All components should reference tokens only (no hardcoded colors)

### 1.3 Shared Navigation Bar (all pages)
**Current problem:** Nav styles are in `style.css` with hardcoded colors (`#111`, `blueviolet`). Each page re-implements its own nav HTML.

**Plan:**
- Create `css/nav.css` — extracted, token-based nav component
- Glassmorphism nav: `backdrop-filter: blur(16px)`, semi-transparent `--glass-bg`
- Sticky top with subtle bottom glow line (`border-bottom: 1px solid var(--glass-border)`)
- Logo with gradient text (`background-clip: text` using `--gradient-primary`)
- Nav links: hover glow underline animation (purple → cyan sweep)
- Active page indicator (glowing dot or underline)
- Mobile: hamburger menu with slide-in drawer (animated)
- Auth buttons (Sign Up / Logout) with gradient backgrounds + hover glow
- Dark/light toggle icon in nav

### 1.4 Shared Button System (`css/components.css`)
- **Primary button:** Gradient purple bg, glow on hover, scale-up micro-animation
- **Secondary button:** Glass bg with border, glow on hover
- **Danger button:** Rose/red variant
- **Ghost button:** Transparent with text color, underline on hover
- **Icon button:** Circular, glass bg
- All buttons: `transition: all var(--transition-base)`, `transform: scale(1.03)` on hover
- Loading state: shimmer animation on button surface

### 1.5 Shared Card System
- **Glass card:** `--glass-bg` background, `--glass-border`, `backdrop-filter: blur`
- Hover: lift (`translateY(-4px)`), glow shadow (`--glow-primary-subtle`), border brightens
- Entry animation: `fadeInUp` with stagger delays
- Variants: movie card, group card, friend card, notification card

### 1.6 Shared Form Inputs
- Dark input fields with `--bg-input` background
- Focus: glowing purple border (`box-shadow: --glow-primary`)
- Labels float or slide up on focus (animated)
- Error states: rose glow border + shake animation
- Success states: emerald glow border

### 1.7 Shared Modal System
- Glass overlay with blur backdrop
- Modal slides up from bottom (`slideInUp` animation)
- Close button with rotation on hover
- Smooth exit animation (`fadeOut` + `slideDown`)

### 1.8 Toast Notification System
- Bottom-right positioned notification stack
- Slide in from right, auto-dismiss after 4s
- Types: success (emerald), error (rose), info (cyan), warning (amber)
- Each with matching glow accent and icon
- Add to `app.js` as `showToast(message, type)`

---

## Phase 2: Page-by-Page Overhaul

### 2.1 Landing Page (`website.html`)
**Current:** Basic hero with text + movie poster, inline styles, hardcoded colors.

**Overhaul:**
- **Hero Section:**
  - Full-viewport height hero with animated gradient mesh background
  - Large cinematic heading with gradient text (purple → cyan)
  - Subtitle with typewriter or fade-in-word animation
  - CTA buttons with glow pulse animation
  - Hero movie poster with 3D tilt effect on hover (CSS `perspective` + `transform`)
  - Floating particles or film reel decorative elements (CSS-only)
- **Featured Movies Section:**
  - Horizontal scrolling row (Netflix-style) with poster-focused cards
  - Cards: large poster, title + rating overlay on hover with glass bg
  - Smooth scroll with CSS `scroll-snap`
  - Section heading with decorative gradient line
- **Trending Section:**
  - Grid of poster cards with stagger entrance animation
  - Hover: poster scales slightly, neon glow border appears, info overlay slides up
- **Footer:**
  - Glass bg footer with gradient top border
  - Consistent across all pages

### 2.2 Login Page (`Log_In.html`)
- Centered glass card on gradient mesh background
- Animated form: inputs slide in sequentially
- Password field: toggle visibility icon
- Login button: gradient with loading shimmer on submit
- "Don't have an account?" link with glow on hover
- Error messages: shake animation + rose glow

### 2.3 Sign Up Page (`Sign_Up.html`)
- Same glass card treatment as Login
- Multi-step feel (even if single form): field groups with subtle dividers
- Password strength indicator bar (animated, color transitions)
- Success: confetti-like animation or green glow pulse

### 2.4 Binge Bank (`Binge_Bank.html`) — Movie Search & Discovery
**Current:** Basic search box, grid of movie cards with inline styles.

**Overhaul:**
- **Search Section:**
  - Glass card search container with neon border glow
  - Large search input with magnifying glass icon, purple glow on focus
  - Filter chips below search (genre, year, rating) — pill-shaped, toggle with color fill
  - Search button with gradient + pulse on hover
- **Movie Results Grid:**
  - Poster-focused cards (large poster image fills card)
  - On hover: poster dims slightly, glass overlay slides up with title, year, rating stars, genre tags
  - "Add to Watchlist" button appears on hover with cyan glow
  - Stagger entrance animation when results load
  - Loading state: skeleton cards with shimmer animation
- **Popular/Trending Sections:**
  - Horizontal scroll rows with scroll-snap
  - Section headers with gradient accent line

### 2.5 Stream Team (`Stream_team.html`) — Groups
**Current:** Group list and management with basic styling.

**Overhaul:**
- **Group Cards:**
  - Glass cards with member avatars stacked (overlapping circles)
  - Group name with gradient text
  - Member count badge with glow
  - Hover: card lifts, border glows purple
- **Create Group:**
  - Modal with glass bg, animated form fields
  - Color/icon picker for group identity
- **Group Detail View:**
  - Header with group name, member list (avatar row)
  - Tabbed interface (Watchlist / Movie Nights / Members) with animated tab indicator
  - Watchlist: poster grid with vote indicators (star ratings with glow)
  - Movie night scheduling: calendar-style picker with neon highlights

### 2.6 Heads Up (`heads_up.html`) — Movie Nights & Scheduling
**Overhaul:**
- Movie night cards with date/time prominently displayed
- Countdown timer for upcoming nights (animated digits)
- Availability grid with glowing selected cells
- Voted movies shown as ranked poster list with position badges (gold/silver/bronze glow)

### 2.7 Friends Page (`Friends.html`)
**Overhaul:**
- Friend cards: avatar, name, online status dot (green glow pulse)
- Friend request cards: glass card with accept/decline buttons (emerald/rose)
- Search friends: input with user icon, results dropdown
- Stagger animation on friend list load

### 2.8 Settings Page (`Setting.html`)
**Overhaul:**
- Sectioned glass cards (Profile, Preferences, Account)
- Toggle switches with smooth animated slides (purple when active)
- Theme selector preview (dark/light thumbnails)
- Save button with success glow animation on save
- Danger zone (delete account) at bottom with rose border

---

## Phase 3: Animations & Micro-Interactions

### 3.1 Page Transitions
- Fade-in on page load (`body` starts `opacity: 0`, animates to `1`)
- Content sections animate in on scroll (intersection observer in `app.js`)

### 3.2 Enhanced Animations (`css/animations.css`)
Add these keyframes:
- `@keyframes neonPulse` — alternating purple/cyan glow
- `@keyframes float` — subtle up/down bobbing for decorative elements
- `@keyframes typewriter` — for hero text
- `@keyframes borderGlow` — animated gradient border rotation
- `@keyframes confetti` — success celebration
- `@keyframes shake` — error feedback
- `@keyframes ripple` — button click effect
- `@keyframes tilt3D` — card hover perspective shift

### 3.3 Scroll-Triggered Animations
- Add `data-animate` attribute to sections
- `app.js` IntersectionObserver watches and adds `.is-visible` class
- Elements fade/slide in as user scrolls down

### 3.4 Hover States (Global)
- All interactive elements: smooth `transform` + `box-shadow` transitions
- Cards: lift + glow
- Buttons: scale + glow
- Links: gradient underline sweep
- Images/posters: slight zoom (`scale(1.05)`) with overflow hidden

---

## Phase 4: Responsive & Polish

### 4.1 Mobile Breakpoints
- **1024px:** Adjust grid columns (3 → 2)
- **768px:** Hamburger nav, stack layouts, full-width cards
- **480px:** Single column, larger touch targets, simplified animations

### 4.2 Performance
- Use `will-change` sparingly for animated elements
- Prefer `transform` and `opacity` for animations (GPU-composited)
- Lazy load movie poster images (`loading="lazy"`)
- Reduce animation complexity on `prefers-reduced-motion`

### 4.3 Accessibility
- Maintain focus-visible outlines (using `--primary` color)
- `prefers-reduced-motion: reduce` — disable non-essential animations
- `prefers-color-scheme` — default to matching OS theme
- ARIA labels on icon buttons, toggle switches
- Sufficient color contrast ratios in both themes

---

## File Structure (New/Modified)

```
frontend/public/
├── css/
│   ├── tokens.css          # UPDATE — add light theme, new tokens
│   ├── reset.css            # UPDATE — minor tweaks
│   ├── animations.css       # UPDATE — add new keyframes
│   ├── components.css       # NEW — buttons, cards, forms, modals, toasts
│   ├── nav.css              # NEW — shared navigation component
│   └── utilities.css        # NEW — helper classes (flex, grid, spacing, text)
├── style.css                # UPDATE — refactor to use tokens, remove hardcoded colors
├── app.js                   # UPDATE — add toast system, scroll observer, theme toggle
├── website.html             # UPDATE — full redesign
├── Log_In.html              # UPDATE — glass card form
├── Sign_Up.html             # UPDATE — glass card form
├── Binge_Bank.html          # UPDATE — poster-focused redesign
├── Stream_team.html         # UPDATE — glass cards, tabs
├── heads_up.html            # UPDATE — countdown, availability grid
├── Friends.html             # UPDATE — friend cards
└── Setting.html             # UPDATE — sectioned settings
```

---

## Implementation Order

1. [x] **Tokens + Reset + Animations** — Foundation updates
2. [x] **`components.css`** — Buttons, cards, forms, modals, toasts
3. [x] **`nav.css` + theme toggle** — Shared nav with dark/light mode
4. [x] **`app.js` updates** — Toast system, scroll observer, theme persistence
5. [x] **Landing page** (`website.html`) — Showcase the new design system
6. [x] **Auth pages** (`Log_In.html`, `Sign_Up.html`) — Quick wins, glass cards
7. [x] **Binge Bank** (`Binge_Bank.html`) — Core feature, poster cards
8. [x] **Stream Team** (`Stream_team.html`) — Groups with tabs
9. [x] **Heads Up** (`heads_up.html`) — Movie nights
10. [x] **Friends** (`Friends.html`) — Friend cards
11. [x] **Settings** (`Setting.html`) — Sectioned layout
12. [x] **Responsive pass** — All pages at 1024/768/480
13. [ ] **Polish pass** — Reduced motion, performance, accessibility audit

---

## Design References

- **Color palette:** Deep navy/charcoal backgrounds, neon purple (#a855f7) + cyan (#06b6d4) accents
- **Glass effect:** Semi-transparent backgrounds with backdrop blur (frosted glass)
- **Glow effects:** Colored box-shadows on interactive elements
- **Typography:** Inter for body, display font for headings
- **Inspiration:** Streaming platform UIs (Netflix, Disney+), gaming dashboards, neon aesthetic
