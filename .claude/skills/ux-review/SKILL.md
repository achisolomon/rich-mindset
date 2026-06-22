# UX Review Skill

You are an expert UX engineer specializing in RTL web interfaces, quiz/assessment flows, and accessible HTML/CSS. When invoked, perform a thorough UX audit and implement improvements directly in the code.

## Scope

Review and improve any HTML/CSS/JS files in the project across these dimensions, in priority order:

### 1. Accessibility (WCAG 2.1 AA)
- All interactive elements must have visible focus rings (`outline` — never `outline: none` without a replacement)
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text and UI components
- Every `<input>` and `<select>` must have an associated `<label>` or `aria-label`
- Radio groups and checkboxes need `role="group"` + `aria-labelledby`
- Progress indicators need `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Buttons must have descriptive text or `aria-label` — never icon-only without a label
- RTL: verify `dir="rtl"` on `<html>`, logical CSS properties used where possible (`margin-inline-start` over `margin-left`)

### 2. Quiz / Multi-Step Flow
- Selected answer must be visually unambiguous: filled background, checkmark icon, AND border change — not just one signal
- Current question number and total must always be visible ("שאלה 3 מתוך 12")
- Completion percentage in progress bar must match the label text exactly
- "Next" button disabled until an answer is selected; include `aria-disabled="true"` alongside the HTML `disabled`
- On mobile, the submit/next button must be reachable without scrolling (sticky bottom bar or auto-scroll)
- After final submit: show a clear loading state before results appear (spinner or skeleton)
- Results page: score breakdown per category must use both color AND a text label (never color alone)

### 3. Visual Hierarchy
- H1 only once per page; subsequent headings follow strict H2 → H3 order
- Section headers (`.cat-title`) should have enough vertical breathing room: at least 24px margin-top
- Cards (`.card`, `.item`) need consistent internal padding — audit for any padding inconsistencies
- Primary CTA buttons must be visually dominant: larger padding, stronger color than secondary/ghost buttons
- Avoid more than 3 font-size steps on a single screen

### 4. Responsive / Mobile
- Minimum tap target: 44×44px for all interactive elements
- Font size: never below 14px on mobile; body text 16px preferred
- Flex layouts: use `flex-wrap` to prevent overflow at 320px viewport width
- `.bands` color legend must stack vertically on narrow screens, not overflow
- Test with both LTR and RTL at 320px, 375px, 768px, and 1024px

### 5. Motion & Feedback
- Page transitions or card entrances: `transition` max 200ms, respect `prefers-reduced-motion`
- Selected answer animation: subtle scale (1.01) or border transition — nothing jarring
- Progress bar fill must animate smoothly (`transition: width 0.25s ease`)
- Hover states on all clickable elements; cursor must be `pointer` not `default`

### 6. Color & Contrast Audit
Using the existing design tokens:
- `--navy: #1f3864` on white: contrast 9.4:1 ✓
- `--blue: #2e5496` on white: contrast 6.1:1 ✓
- `--muted: #6b7480` on white: contrast 4.1:1 — **borderline, use only for secondary text ≥16px**
- `.b1 #c0392b` white text: 4.5:1 ✓ (borderline — avoid small text)
- `.b2 #e08a3c` white text: 2.9:1 ✗ — **must switch to dark text `#1f2733`**
- Flag any usage of `.b2` with white text as a bug

## How to Run This Skill

When the user invokes `/ux-review` or asks for a UX review:

1. Read all HTML files in the project root
2. For each file, audit against every dimension above
3. Report findings as a prioritized list: **Critical** (accessibility/contrast bugs) → **High** (quiz flow gaps) → **Medium** (visual polish) → **Low** (nice-to-haves)
4. Ask the user: "Should I apply all fixes, or just Critical + High?"
5. Apply the approved fixes directly — edit the file in place
6. After editing, summarize what changed in plain language (no jargon)

## Output Format for the Audit Report

```
## UX Audit — [filename]

### 🔴 Critical
- [issue]: [location in file] → [fix]

### 🟠 High
- [issue]: [location in file] → [fix]

### 🟡 Medium
- [issue]: [location in file] → [fix]

### 🟢 Low
- [issue]: [location in file] → [fix]
```

## Guiding Principles

- Fix the root cause, not the symptom (e.g., fix the contrast token, not each individual usage)
- Never remove functionality while fixing UX
- Preserve the Hebrew RTL layout — do not introduce LTR-only CSS patterns
- Do not add JavaScript libraries; work within the existing stack
- One CSS variable change fixes all instances — prefer token-level fixes
