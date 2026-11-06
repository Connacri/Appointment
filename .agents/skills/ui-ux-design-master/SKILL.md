---
name: ui-ux-design-master
description: Unified UI/UX design, review and implementation skill. Mobile-first and responsive. Merges Apple HIG, landing-page design, Design System Generator, design-engineering practices and interface psychology laws (Fitts, Gestalt, Jakob). Use for creating, auditing, correcting or improving any web, mobile or desktop interface, responsive checks and mobile design. Triggers include design, UI, UX, landing page, accessibility audit, HIG review, design system, responsive, mobile, component, improve this screen, theme, dark mode, onboarding, form, iPhone Duo, Apple Pay.
---

# UI/UX Design Master

## 0. Provenance, fidelity and expertise

This skill is the operational fusion of:

| Source | Kept contribution |
|---|---|
| dickwu/apple-design-skill | 8 Apple principles, HIG review (What/Why/Fix), blocking accessibility thresholds, platform conventions, visual craft, specialized modes (icons, dark mode, Liquid Glass, iPhone Duo, Apple Pay, onboarding, forms, widgets, components), code-audit, improvement mode, cross-platform translation |
| elayadesign/ai-design-skills (landing-page-design) | Intake, page structure, conversion copy, visual system (type, spacing, radius, motion), editable values in one place |
| nextlevelbuilder/ui-ux-pro-max-skill | Design System Generator (5 parallel searches), 192 sector rules, style taxonomy, palettes, type pairings, patterns, anti-patterns, pre-delivery checklist, theme migration, resilient text |
| ibelick/ui-skills | UI baseline, motion, composition, focus management, tokens, design-engineering discipline |
| User instructions / master-ui-ux-psychology-skill | 5 mandatory laws (Fitts, Closure, Figure-Ground, Proximity, Jakob), complementary principles, 10-step method, recommendation format, final rule, strict anti-slop design-system rules (typography, spacing, motion, states, content realism) |
| [EXPERTISE] | Complete responsive & mobile doctrine (§5), mobile performance, gestures, thumb zones, mobile forms, offline, RTL/i18n, animation budget, Dynamic Type, responsive audit (Mode H), mobile design audit (Mode I) |

**Fidelity rules:**
1. Never invent a guideline value. If a number is not in the sources or this skill, cite the source or ask.
2. For exhaustive data (123 HIG pages, 192 palettes, 79 styles, 74 pairings, 34 patterns), load original repository files (§14).
3. Items marked [EXPERTISE] are additions, not guideline citations.
4. This skill provides reasoning, thresholds, checklists and formats. It does not replace source databases.

## 1. Mission and posture

You are an expert AI in UI, UX, mobile/web ergonomics and cognitive psychology. For every interface creation, analysis, correction or improvement, systematically apply the principles below by default, without replacing real user needs, accessibility, security or tests.

You do not stop at making things pretty. Improve first clarity, ease of use, accessibility and reliability, mobile-first, then expand.

## 2. The 8 Apple principles (review frame)

1. **Purpose** — every screen has a clear objective.
2. **Agency** — the user keeps control (cancel, exit, choice).
3. **Responsibility** — security, privacy, predictability.
4. **Familiarity** — platform conventions respected.
5. **Flexibility** — adaptation to contexts, devices, abilities.
6. **Simplicity** — reduce noise, one obvious primary action.
7. **Craft** — careful details (type, spacing, states, motion).
8. **Delight** — pleasure without sacrificing clarity.

## 3. Mandatory interface psychology laws

### 3.1 Fitts’s Law — easy-to-reach targets
- Make important actions large enough and easy to touch/click (min. **44×44 pt** mobile, **28×28 pt** desktop; prefer 44/48 px everywhere for comfort).
- Place frequent actions in easy-to-reach zones (bottom of screen on mobile when the flow allows).
- Avoid small targets, especially close buttons, isolated icons, destructive actions.
- Separate targets to reduce fat-finger errors.
- Reduce distance between the user and the next action.
- Never sacrifice precision, accessibility or safety for a few pixels.

### 3.2 Closure (Gestalt) — show just enough
- Use the brain’s ability to complete incomplete shapes/patterns when it simplifies.
- Icons, logos, cards, cropped images, progress can suggest without showing everything.
- Carousel: let part of the next item appear.
- Keep visual cues coherent and understandable.
- Never hide essential information, an important command or a necessary state under the pretext of minimalism.

### 3.3 Figure-Ground (Gestalt) — create a focal point
- Make the main element stand out via contrast, spacing, size, position or background.
- Clear hierarchy: main title, secondary content, actions.
- Modal: dim the background, keep the window readable and accessible.
- Primary CTA: sufficient contrast with neighbors.
- Avoid every element competing for attention.
- Respect accessible contrast; never convey information by color alone.

### 3.4 Proximity Law — group what belongs together
- Related items close: labels and fields, price and product, associated actions, titles and content.
- Use spacing to distinguish groups; consistent intra-group spacing, larger inter-group spacing.
- Do not visually separate information that must be understood together.
- Do not assemble unrelated commands just because space remains.

### 3.5 Jakob’s Law — respect known conventions
- Prefer familiar interaction models: search at top, predictable navigation, recognizable cart, profile in expected place, identifiable primary button.
- Keep conventions of similar apps/sites when users expect them.
- Understandable icons and labels; add a label if the icon alone is ambiguous.
- Do not reinvent common flows without clear reason.
- Original visual identity is fine, but behaviors, navigation and interactions must stay predictable.

## 4. Complementary principles

### 4.1 Accessibility and ergonomics (blocking)
- Design for different abilities, ages, devices and contexts.
- Comfortable touch targets, readable contrast, clear typography, explicit labels.
- Keyboard, screen readers, `prefers-reduced-motion` when the platform allows.
- Do not rely solely on color, sound, motion or position.
- Signal errors clearly and explain how to fix them.

**Non-negotiable thresholds:**
- Text contrast: **≥ 4.5:1** (normal), **≥ 3:1** (large text ≥ 24 px, or ≥ 18.66 px bold).
- UI/component and focus contrast: **≥ 3:1**.
- Touch target: **≥ 44×44 pt iOS**, **≥ 48×48 dp Android**, **≥ 44 px Web**; WCAG 2.2 AA floor (2.5.8) = **24×24 px CSS** with spacing.
- Text zoom and text scaling without clipping.
- Visible focus for keyboard navigation.
- `prefers-reduced-motion` respected.

### 4.2 Visual hierarchy and cognitive load
- One clear primary objective per page.
- Reduce visual noise, useless decoration, simultaneous choices.
- Break complex flows into steps.
- Show details at the useful moment, without hiding information needed for a decision.
- Consistent titles, groupings and visual states.

### 4.3 State feedback and error prevention
- Confirm important actions: loading, success, failure, progress.
- Prevent double submissions.
- Prevent errors via constraints, examples, clear validation.
- Irreversible/destructive actions: explain the consequence, ask for confirmation.
- Provide undo when realistic (snackbar with “Cancel”, temporary trash).

### 4.4 Consistency and design system
- Reuse conventions, spacing, colors, components, behaviors.
- Consistent styles: primary/secondary/destructive buttons, fields, alerts, cards, navigation.
- Respect existing components and technical constraints unless there is an explicit reason to change.
- Avoid decorative variations without UX benefit.
- Semantic tokens (`background`, `surface`, `foreground`, `primary`, `border`, `ring`) — do not create a parallel system.

### 4.5 Mobile-first and usage context
- Check interfaces on small screens, portrait, one-handed use.
- Prioritize frequent actions; keep important commands in reachable zones.
- Anticipate slow network, offline, loading and empty content when relevant.
- Avoid overflow, truncated text, interactions requiring excessive precision.

### 4.6 Strict Design System & Anti-Slop Rules (mandatory execution)

These rules prevent generic “AI UI slop”. Apply them on every implementation and review.

**A. Typography & readability**
- Strict scale only: use the framework’s default type scale (e.g. Tailwind `text-xs` → `text-6xl`). Never arbitrary values (`text-[19px]`, `font-size: 22px`).
- Text alignment: `text-balance` for headings, `text-pretty` for paragraphs (avoid orphans).
- Data: `tabular-nums` for numbers and tabular data.
- Limits: maximum 1–2 font families per project. Never italic for common UI labels. Never ultra-bold (900) for body/UI text.

**B. Spacing & layout**
- Strict spacing scale only: predefined values (0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px or equivalent tokens). No intermediate values.
- Nested radii: if an element sits inside a container with gap < 32 px, inner radius = outer radius − gap (result > 2 px).
- Borders: never apply a border on a single side of a card. Borders go all around or do not exist.
- Backgrounds: no gradients on card or section backgrounds (exception only for justified text effects in a hero).
- Dimensions: prefer `h-dvh` over `h-screen` (mobile URL bar). Use `size-*` for square elements.

**C. Motion & interactions**
- Animate only compositor properties (`transform`, `opacity`). Never animate `width`, `height`, `top`, `left`, `margin` or `padding`.
- Easing & duration: deceleration curve (e.g. `cubic-bezier(0.22, 1, 0.36, 1)`). Max 200 ms for interaction feedback, 500 ms for layout changes.
- Motion accessibility: always respect `prefers-reduced-motion` (replace movement by a simple opacity change).
- Focus: every interactive element must have a visible focus state for keyboard navigation.

**D. Component integrity & states**
- Accessible primitives: use accessible primitives (Radix, Base UI, React Aria, etc.) for anything that manages keyboard or focus. Never re-implement this behaviour by hand.
- Mandatory states for every interactive element: rest, hover, active (e.g. `scale(0.98)` or `translateY(1px)`), focus, loading (skeleton/shimmer preferred over generic circular spinner), empty (with a clear next action), error (inline and specific, never `window.alert()`).
- Destructive actions: always use an AlertDialog (or equivalent confirmation pattern).
- Input: never block paste in `input` or `textarea` fields.

**E. Content realism**
- No fake content: never invent prices, statistics, testimonials or logos for a real product. Use clear placeholders (e.g. `{{price}}`, `{{client_name}}`) when data is missing.
- Writing quality: no generic marketing words (“revolutionize”, “supercharge”). Use Sentence case for titles and buttons. Error messages must be calm and specific.

**F. Platform conventions (quick)**
- Mobile-first: verify at 375 px, portrait, one-handed. Respect `safe-area-inset` for fixed elements.
- Navigation: bottom tab bar (mobile) or sidebar (desktop). Tabs are for navigation, not for actions.
- Appearance: handle light/dark natively with semantic colors. Do not offer a manual appearance switch inside the app unless the product explicitly requires it.
- Network & states: plan for slow network, offline, loading and empty content when relevant to the product.

## 5. Responsive & mobile design — complete doctrine [EXPERTISE]

This section is intentionally detailed: it is the foundation the four sources do not provide exhaustively.

### 5.1 Approach and breakpoints

**Mobile-first**: design first at 320–375 px, then enrich. Media queries are `min-width` by default; `max-width` only for documented exceptions.

**Content-based breakpoints**, not device names. A breakpoint is placed where the layout breaks, not where an iPhone stops.

**Reference** (adapt, never apply mechanically):
`320` (WCAG reflow floor) · `375` (small mobile) · `414` (large mobile) · `768` (tablet portrait) · `1024` (tablet landscape / small desktop) · `1280` · `1440` · `1920`.

**Verification rule**: test **at breakpoints AND between** (e.g. 390, 600, 900, 1200). Responsive bugs often live between the steps.

### 5.2 Viewport and zoom

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Forbidden: `maximum-scale=1`, `user-scalable=no`, `minimum-scale > 1`. This violates WCAG 1.4.4 and breaks mobile accessibility.

### 5.3 Units and fluid typography

- Type in `rem`/`em`, not fixed `px` on titles: respects browser zoom and OS text scaling.
- Spacing in `rem` to follow user preferences; `px` acceptable for borders and hairlines.
- Viewport heights in `dvh` / `svh` / `lvh`. `100vh` alone breaks on mobile because of the dynamic URL bar. Use `100dvh` for full screens, `100svh` when visibility must be guaranteed.
- No fixed width in `px` on a content container.

Fluid typography:

```css
font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem);
```

Always with a min and a max — a clamp without bounds is a latent bug. Check rendering at 200 % zoom and at 320 px.

### 5.4 Layout: Grid, Flex, and the overflow trap

- CSS Grid with `repeat(auto-fit, minmax(280px, 1fr))` for card collections.
- On every flex or grid child that may contain long content (URL, code, identifier, email): `min-width: 0` (and `min-height: 0` in column). Without it the content forces the parent to overflow.
- `overflow-wrap: anywhere` (or `break-word`) on long-token zones.
- `overflow-x: hidden` is NOT a fix: it is a bandage that hides the bug. Fix the cause.

### 5.5 Container queries

`@container` for reusable components (cards, widgets, panels, tables); `@media` reserved for page layout. A component must adapt to its container, not to the screen — otherwise it breaks as soon as it is placed in a sidebar or nested grid.

```css
.card-wrapper { container-type: inline-size; }
@container (min-width: 400px) { .card { flex-direction: row; } }
```

### 5.6 Images and media

- `srcset` + `sizes` (or `<picture>` for art direction).
- Always set `width` and `height` + declare `aspect-ratio` → reserves space, avoids CLS.
- `loading="lazy"` outside initial viewport; `fetchpriority="high"` on the LCP image (never lazy on it).
- `decoding="async"` on non-critical images.
- Video: `preload="metadata"`, `playsinline`, `muted` if autoplay.
- Inline SVG for icons (weight + color via `currentColor`).

### 5.7 Hover, pointer and touch

- Every `:hover` inside `@media (hover: hover) and (pointer: fine)` — otherwise the effect “sticks” after a tap on mobile.
- Enlarged targets inside `@media (pointer: coarse)`.
- An important state must never depend on hover alone (WCAG 1.4.13: hover content must be reachable by keyboard and touch).
- Do not remove `:active`: it is the immediate tactile feedback.

### 5.8 Safe areas and orientation

- `env(safe-area-inset-*)` with `viewport-fit=cover` for notches, Dynamic Island and gesture bar.
- Safe-area padding on fixed bars (top and bottom), not only on content.
- Test portrait AND landscape. In mobile landscape useful height is low: check that nothing essential is cut, lateral safe areas are respected, and modals do not overflow.

### 5.9 Mobile design patterns [EXPERTISE]

**Thumb zone**: the lower third is comfortable; upper corners are hard to reach one-handed. Place frequent actions at the bottom (tab bar, sticky CTA, FAB); reserve the top for navigation and context.

**Navigation**:
- ≤ 5 primary destinations → bottom tab bar (iOS/Android) or bottom nav on web.
- Fixed tab bar: always visible, safe area respected, labels under icons if ambiguity.
- Avoid hamburger menus for primary navigation — they cost discoverability.
- Page title must indicate where the user is, without ambiguity.

**Sheets vs modals**:
- Short contextual action → bottom sheet (close to the thumb, natural dismiss gesture).
- Blocking decision / critical confirmation → centered dialog, with keyboard escape and explicit button.
- Rich content page → full-screen navigation, not a modal.
- Every modal: dismiss by tap on backdrop, close button, and Escape key.

**Gestures**:
- Swipe-to-delete, pull-to-refresh, long press: always paired with a visible alternative (WCAG 2.5.7 — dragging movements). A gesture alone is inaccessible.
- Gestures must not conflict with system gestures (edges, bottom of screen).

**Mobile forms**:
- Correct `type` (email, tel, url, number), `inputmode` (numeric, decimal, email), `autocomplete` (email, current-password, new-password, one-time-code, street-address…).
- Visible labels above the field — placeholder is not a label (it disappears on input and breaks contrast).
- One field = one objective; avoid multi-column forms on mobile.
- Mobile keyboard tested: the active field must not be hidden by the keyboard; `scroll-padding-bottom` or automatic scroll-up.
- Inline validation on blur, not on every keystroke; error messages under the field, in text, linked by `aria-describedby`.
- Never block paste in password / code fields.
- Submit button: blocked while sending, visible loading state, no double submission.

**Scroll and content**:
- Sticky header: minimal height, transparency + blur only if readability is preserved.
- Long lists: progressive loading or virtualization; never load everything at once on mobile.
- `scroll-snap` sparingly: it can block natural scroll.
- `scroll-behavior: smooth` only if `prefers-reduced-motion` is not active.

**Tactile feedback**: visible `:active`, light haptics on important actions (native), short transitions. No feedback that is only auditory.

**States**:
- Skeleton for structured content loading; spinner for a one-off action; progress bar for known duration.
- Empty state: explain why it is empty and propose the next action.
- Error state: cause + remedy + recovery action.
- Offline: discreet banner, queued actions if relevant, never silent loss.
- Success: brief non-blocking confirmation, with undo if the action is reversible.

### 5.10 Mobile performance [EXPERTISE]

Responsive is not only a width question: a responsive site that is slow on mobile is a UX failure.

Core Web Vitals (mobile, 4G network):
- LCP < 2.5 s
- INP < 200 ms
- CLS < 0.1

Levers:
- Initial weight: aim < 150–200 KB compressed JS on the critical path.
- Fonts: `font-display: swap`, preload main font, subset if possible; avoid more than 2 families.
- Images: modern formats (AVIF/WebP), sized, never a 2000 px image displayed at 375 px.
- Avoid heavy libraries for a single component; prefer native (`dialog`, `details`, `popover`).
- Interactions: no expensive scroll handlers without `passive: true` or throttling.
- Test under Slow 4G network emulation and CPU throttling, not only locally.

### 5.11 Tablet and desktop

- Tablet (768–1024): often one column + collapsible sidebar, not a shrunk desktop. Check multitasking (Split View iPad, Android split-screen) and continuous resizing.
- Desktop: `max-width` on content (typically 1200–1440 px), line-length 45–75 characters for body text, generous margins. Do not stretch a text column across 1920 px.
- Adapt density, not only width: more information visible on large screens, persistent side navigation possible.
- Test continuous resizing (not only at breakpoints): nothing must break between two steps.

### 5.12 WCAG reflow, zoom and spacing

- 1.4.10 Reflow: at 320 px CSS width, no horizontal scroll (except justified complex data tables).
- 1.4.4 Resize text: at 200 % zoom, content readable and functional.
- 1.4.12 Text spacing: support user spacing overrides without clipping.
- 2.5.8 Target size: minimum 24×24 px CSS (AA); aim for 44/48 px (AAA and platform best practices).
- 2.5.7 Dragging movements: every drag has a simple pointer/tap alternative.
- 1.4.13 Content on hover/focus: every hover-revealed content is reachable and dismissible by keyboard.

### 5.13 User preferences

All respected and tested:
- `prefers-color-scheme` (light / dark)
- `prefers-contrast` (more / less / custom)
- `forced-colors` (Windows High Contrast) — do not break native borders and focus
- `prefers-reduced-motion` (reduce / no-preference)
- `prefers-reduced-transparency` (Apple)

### 5.14 Native responsive (non-web)

- Flutter: `LayoutBuilder`, `MediaQuery.sizeOf(context)`, `SafeArea`, Material 3 breakpoints (compact < 600, medium 600–839, expanded ≥ 840), `NavigationBar` / `NavigationRail` / `NavigationDrawer` according to width.
- React Native: `useWindowDimensions` (not fixed `Dimensions.get`), `SafeAreaView`, `flexWrap`, `useColorScheme`, `AccessibilityInfo.isReduceMotionEnabled`.
- SwiftUI: `@Environment(\.horizontalSizeClass)`, `GeometryReader` sparingly, Dynamic Type (`Font.TextStyle`), `safeAreaInset`.
- Jetpack Compose: `WindowSizeClass`, `Modifier.safeDrawingPadding()`, `LocalConfiguration` for orientation, `fontScale`.
- In all cases: never assume a screen size, read the platform size classes.

### 5.15 Responsive & mobile checklist

☐ Rendered at 320 / 375 / 414 / 768 / 1024 / 1280 / 1440 / 1920 px and between steps.
☐ No horizontal scroll at 320 px (WCAG 1.4.10).
☐ 200 % zoom without loss or overflow (WCAG 1.4.4).
☐ Portrait and landscape tested; safe areas OK in landscape.
☐ No fixed width in px on a content container.
☐ `min-width: 0` on flex/grid children exposed to long content.
☐ Fluid type (`clamp` with min and max) — no brutal steps.
☐ Viewport heights in `dvh`/`svh`, not `100vh` alone.
☐ Container queries on reusable components.
☐ Images: `srcset`/`sizes`, `aspect-ratio`, `width`/`height`, `fetchpriority` on LCP.
☐ Hover isolated in `@media (hover: hover)`; targets ≥ 44/48 px on `pointer: coarse`.
☐ Tablet: not a shrunk desktop; Split View tested.
☐ Desktop: line-length 45–75 ch, content centered with `max-width`.
☐ `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, `prefers-reduced-motion` verified.
☐ Forms: correct `type`, `inputmode`, `autocomplete`; mobile keyboard tested.
☐ Gestures paired with a visible alternative.
☐ Mobile Core Web Vitals: LCP < 2.5 s · INP < 200 ms · CLS < 0.1.
☐ States: rest, active, focus, loading, success, error, empty, offline.
☐ Main flow achievable one-handed on mobile.

## 6. Mandatory 10-step working method

1. Understand the objective: who uses the screen, for what, in which context (device, one hand / two hands, network)?
2. Identify the primary action: make it immediately visible and easy to reach.
3. Organize content: proximity, visual hierarchy, figure-ground.
4. Check conventions: Jakob’s law, predictable flows.
5. Check targets: Fitts’s law, especially mobile.
6. Simplify without losing meaning: use closure only if it improves understanding.
7. Check accessibility: contrast, sizes, labels, navigation, error states.
8. Check responsive and mobile: §5 and §5.15.
9. Check states: rest, interaction, loading, success, error, empty, offline.
10. Justify choices and flag trade-offs: prioritize understanding, accessibility and safety.

## 7. Operating modes

Trigger the appropriate mode. If ambiguous, ask a short clarification.

**Mode A — Design System Generator**  
When: “create a landing page / dashboard / app for X”.  
Process (5 parallel searches): product type, UI style, palette, landing pattern, type pairing.  
Engine: match product → UI rules → prioritize styles → filter sector anti-patterns → apply decision rules.  
Mandatory output: TARGET, PATTERN, STYLE, COLORS, TYPOGRAPHY, KEY EFFECTS, AVOID, RESPONSIVE, PRE-DELIVERY CHECKLIST.

**Mode B — Landing page build**  
Intake, Structure, Conversion copy, Visual system, Editable values grouped, Realistic content, Mobile first.

**Mode C — HIG Review / Audit**  
Read relevant guidelines. Cover: 8 principles, Accessibility, Platform conventions, Visual craft, Interaction, Content, Responsive. Format: What / Why / Fix.

**Mode D — Implementation / Design engineering**  
Read existing stack and tokens first. Reuse semantic tokens. Baseline: semantic HTML, visible focus, no emoji as icon, `prefers-reduced-motion`, reflow without clipping.

**Mode E — Improvement / Redesign**  
Anchor design in the product, plan tokens, critique against generic defects, sequence (accessibility → responsive → structure → craft → polish).

**Mode F — Code audit (Apple)**  
Search code for: non-official Apple Pay buttons, misapplied Liquid Glass, fixed widths blocking iPhone Duo adaptation.

**Mode G — iPhone Duo**  
Verify: outer/inner display, partial fold, Split View, size classes, system bars at default location, content outside cameras/fold.

**Mode H — Responsive audit [EXPERTISE]**  
When: “is it responsive?”, “check mobile”. Apply §5.15 fully. Output: What / Why / Fix / Priority / Validation criterion.

**Mode I — Mobile design audit [EXPERTISE]**  
When: “mobile audit”, “UX on phone”. Check thumb zone, navigation ≤ 5 destinations, targets ≥ 44/48 px, bottom sheets, paired gestures, optimized forms, readable header, complete states, tactile feedback, Core Web Vitals, test 320 px / 200 % zoom / landscape / dark mode.

Specialized modes (trigger when targeted): App icons · Dark mode · Liquid Glass · Navigation structure · Apple Pay · Onboarding & permissions · Forms · Generative AI · Widgets & Live Activities · Single component · Deep accessibility.

## 8. Cross-platform translation

| Concept | Apple | Flutter | React Native | Tauri / Electron | Web |
|---|---|---|---|---|---|
| Tab bar | — | BottomNavigationBar / NavigationBar | BottomTabNavigator | custom bar / routes | nav + aria-current |
| Toolbar | — | AppBar | custom header | window bar | `<header>` |
| Sheet | — | showModalBottomSheet | modal bottom sheet | webview modal | `<dialog>` |
| Sidebar | — | Drawer / NavigationRail | drawer | native panel | `<nav>` |
| Safe area | — | SafeArea | SafeAreaView | window margins | env(safe-area-inset-*) |
| SF Symbols | — | Icons / CupertinoIcons | vector icons | SVG | SVG (Lucide/Heroicons) |
| Haptics | — | HapticFeedback | expo-haptics | native plugin | navigator.vibrate |
| Size classes | — | LayoutBuilder / MediaQuery | useWindowDimensions | window | @media / @container |

Always verify that the expected behavior (system adaptation, accessibility, focus) is actually provided by the framework or the code, not assumed.

## 9. Content, writing and internationalization [EXPERTISE]

- Labels that say what happens (“Save”, not “OK”).
- Correct capitalization per platform.
- Errors: explain the problem and the fix.
- Empty states: orient toward the next action.
- No jargon; benefit before feature.
- Resilient text: titles that wrap naturally, long tokens that do not overflow, chips/badges that wrap or use an operable +n, truncation with access to the full value.
- No text in images (accessibility, i18n, zoom).
- Plan +30 to +40 % length for translations (German, Finnish); test with long strings.
- RTL: use logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline`, `border-inline`) rather than left/right; mirror directional icons; test `dir="rtl"`.
- Localized formats: dates, numbers, currencies, units via `Intl` (web) or native equivalents.
- No text in placeholders alone; no dependence on case for meaning.

## 10. Anti-patterns to refuse

- Emoji used as icons.
- `cursor: default` on a clickable element.
- Contrast < 4.5:1 on normal text.
- Invisible or removed focus.
- Animation ignoring `prefers-reduced-motion`.
- Targets < 44 px (or < 28 px on desktop).
- Information conveyed by color alone.
- Three generic “AI looks” (violet/pink gradients, glassmorphism everywhere, floating cards without hierarchy).
- Arbitrary type sizes or spacing values outside the design-system scale.
- Gradients on card/section backgrounds (except justified hero text effects).
- Single-side borders on cards.
- Animating layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`).
- Generic circular spinner instead of skeleton/shimmer for content loading.
- `window.alert()` for errors.
- Blocking paste in input fields.
- Invented prices, stats, testimonials or logos for a real product.
- Fixed widths that break responsive and fold.
- `overflow-x: hidden` used to hide an overflow.
- `100vh` alone for a full mobile screen.
- `maximum-scale=1` / `user-scalable=no`.
- Hand-drawn Apple Pay buttons.
- Modals without keyboard escape.
- Unblocked double submission.
- Truncated texts without access to the full value.
- Parallel token system instead of reusing the existing one.
- Hover alone to reveal important information or action.
- Gesture alone without alternative.
- Form without visible label.

## 11. Pre-delivery checklist (mandatory)

**General**
☐ No emoji as icon; SVG (Heroicons/Lucide).
☐ `cursor-pointer` on every clickable element.
☐ Interaction timing adapted to platform, component and preferences.
☐ Text contrast ≥ 4.5:1 (light and dark verified).
☐ UI/focus contrast ≥ 3:1.
☐ Visible focus for keyboard navigation.
☐ `prefers-reduced-motion` respected.
☐ Texts, chips, badges reflow without clipping or broken labels.
☐ States: rest, hover/focus, active, loading, success, error, empty, offline.
☐ Destructive actions: confirmation + undo if realistic.
☐ No information by color alone.
☐ No hard-coded values outside tokens.
☐ RTL and long strings tested.

**Responsive & mobile (detail §5.15)**
☐ 320 / 375 / 414 / 768 / 1024 / 1280 / 1440 / 1920 px + between steps.
☐ No horizontal scroll at 320 px; 200 % zoom without loss (WCAG 1.4.10 / 1.4.4).
☐ Portrait and landscape; safe areas in landscape.
☐ Fluid type (`clamp`), viewport in `dvh`/`svh`, no fixed width on content.
☐ `min-width: 0` on flex/grid children exposed to long content.
☐ Container queries on reusable components.
☐ Images: `srcset`/`sizes`, `aspect-ratio`, `width`/`height`, `fetchpriority` LCP.
☐ Hover in `@media (hover: hover)`; targets ≥ 44/48 px on `pointer: coarse`.
☐ `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, `prefers-reduced-motion`.
☐ Main flow one-handed; thumb zone respected.
☐ Mobile Core Web Vitals: LCP < 2.5 s · INP < 200 ms · CLS < 0.1.

## 12. Recommendation format

For any analysis or proposal:

- Observed problem
- UX principle concerned
- Concrete improvement
- Priority: critical / high / medium / low
- Validation criterion: how to verify the improvement works

For a HIG review, add What / Why (guideline + heading) / Fix (framework).  
For code, provide a solution coherent with the existing stack and architecture. Do not limit yourself to making the screen prettier: improve first clarity, usage, accessibility and reliability.

## 13. Final rule

Apply these principles consistently on every UI/UX task, even if the user does not mention them. Do not apply them mechanically: adapt to context, users, platform and product goals. If a rule seems to contradict a functional need, an accessibility requirement or a security constraint, explain the conflict and choose the safest and most understandable solution.

**Mobile priority rule**: when in doubt, the simplest, most one-hand reachable, most readable and fastest mobile version wins. Desktop is an enrichment, not the reference.

## 14. Routing to complete references

Load original repository files when the task requires exhaustiveness:

- Apple HIG (123 pages) → dickwu/apple-design-skill: references/hig-lookup.md then relevant references/hig/*.md; references/cross-platform.md; references/code-audit.md; references/hig/liquid-glass.md.
- UI UX Pro Max catalogues (192 palettes, 79 styles, 74 pairings, 34 patterns, 192 rules, 119 UX guidelines) → nextlevelbuilder/ui-ux-pro-max-skill repository; run the CLI/BM25 for searches.
- Landing page design values → skills/landing-page-design/SKILL.md of elayadesign/ai-design-skills.
- Design engineering baseline & motion → ibelick/ui-skills (CLI npx ui-skills, MCP https://www.ui-skills.com/mcp, playbook ui-skills.com/playbook).
- Responsive & mobile doctrine: this skill (§5, Modes H and I) is the project reference. For recent browser features (dvh, @container, :has(), prefers-contrast), check compatibility on caniuse.com before recommending.

Never invent a guideline value: if doubt remains, cite the source or ask.