---
name: Gatti E-Rickshaw CRM
description: A conventional, familiar light SaaS admin system — white content on a soft gray ground, one restrained blue accent, standard soft-tint status pills.
colors:
  brand-50: "#eff6ff"
  brand-100: "#dbeafe"
  brand-200: "#bfdbfe"
  brand-300: "#93c5fd"
  brand-400: "#60a5fa"
  brand-500: "#3b82f6"
  brand-600: "#2563eb"
  brand-700: "#1d4ed8"
  brand-800: "#1e40af"
  brand-900: "#1e3a8a"
  slate-50: "#f8fafc"
  slate-100: "#f1f5f9"
  slate-200: "#e2e8f0"
  slate-400: "#94a3b8"
  slate-500: "#64748b"
  slate-700: "#334155"
  slate-900: "#0f172a"
  chip-pos: "#16a34a"
  chip-neg: "#dc2626"
  chip-live: "{colors.brand-600}"
  chip-mute: "#64748b"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.02em"
  tabular:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontFeature: "tnum"
  stat:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  chip: "9999px"
  control: "8px"
  panel: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.brand-700}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.slate-700}"
    rounded: "{rounded.control}"
  chip-live:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-700}"
    rounded: "{rounded.chip}"
  chip-pos:
    backgroundColor: "#f0fdf4"
    textColor: "#166534"
    rounded: "{rounded.chip}"
  chip-neg:
    backgroundColor: "#fef2f2"
    textColor: "#991b1b"
    rounded: "{rounded.chip}"
---

# Design System: Gatti E-Rickshaw CRM

## Overview

This system is a deliberately conventional light SaaS admin look — the visual language most CRM/ops tools already use (Linear, HubSpot, standard admin-dashboard patterns), executed carefully rather than reinvented. A prior pass tried a distinctive dark-shell "scorecard" identity; the user rejected it as poor-looking, and asked explicitly for something safe and familiar instead. That preference is now the standing direction: **do not reintroduce a dark sidebar, an unconventional accent color, or solid-block status tags.**

White content surfaces sit on a soft `slate-50` page background. Navigation (sidebar, topbar) is white with a hairline border, not a colored or dark shell. One restrained blue accent (`brand-600`) carries every primary action, active nav state, and link — never a second competing color. Status reads as a standard soft-tint pill (light background, darker text of the same hue, fully rounded) — the pattern every mainstream CRM uses, not an invented "chip" language.

**Key Characteristics:**
- White sidebar/topbar/cards on a soft gray page background — no dark or colored shell
- One blue accent (`brand-600`), used only for primary actions, active nav, links, and focus rings
- Soft-tint rounded-full status pills (`bg-{color}-50 text-{color}-700`-equivalent), not solid blocks
- Standard 8–12px corner radii throughout; pills stay fully rounded
- Tabular IBM Plex Mono reserved for codes, phone numbers, and counts only

## Colors

A conventional neutral-plus-one-accent palette. Default Tailwind gray/slate values are used for neutrals — no invented neutral ramp.

### Primary
- **Blue** (`brand-600` / `#2563eb`): primary buttons (white text on solid fill), active nav state, links, focus rings.

### Neutral
- **Page ground** (`slate-50` / `#f8fafc`): the background behind every content page.
- **Card white** (`#ffffff`): cards, sidebar, topbar, tables, modals.
- **Ink** (`slate-900` / `#0f172a`): primary text.
- **Hairline** (`slate-200` / `#e2e8f0`): borders and dividers.

### Named Rules
**The One Accent Rule.** Blue is the only accent color used for interactive/primary meaning. A second color competing for "primary" attention (a gold CTA, a purple highlight, a dark colored shell) is a regression to the rejected direction, not a valid variation.

**The Soft Pill Rule.** Every status/lifecycle badge is a light-tint background with a same-hue darker text color, fully rounded (`rounded-full`) — never a solid, high-contrast block. Solid status blocks read as the "bold/gimmicky" system that was explicitly rejected.

## Typography

**Body/UI Font:** Geist (system-ui fallback)
**Tabular/Data Font:** IBM Plex Mono (ui-monospace fallback), for lead/dealer codes, phone numbers, and counts only.

### Hierarchy
- **Display** (600, 1.25–2rem): page titles.
- **Title** (600, 1rem–1.125rem): card/section headings.
- **Body** (400, 0.875rem): default UI text.
- **Label** (600, 11px, uppercase, 0.02em tracking): section eyebrow labels ("TODAY'S CALLING", sidebar section headers, stat labels). The same 11px step is also used untracked/non-uppercase for the smallest plain captions (e.g. the command palette's footer hint).
- **Stat** (600, 1.75rem, tabular IBM Plex Mono): the one large-number style, used for every StatCard/StatRail figure (dashboard, telecalling, reports) — distinct from Display, which is reserved for page-title text.

## Layout

Standard app-shell: a white sidebar (256px expanded / 68px collapsed) and white topbar (64px), both bordered with a hairline rather than colored or dark. Content `<main>` sits on `slate-50`, padded 16–32px by breakpoint. Content pages cap at `max-w-4xl`/`max-w-5xl`. Desktop-office is the confirmed primary context (see PRODUCT.md); existing responsive breakpoints are preserved but not the design priority.

## Elevation & Depth

Flat-leaning with very low ambient shadows on cards (`0 1px 2px rgba(15,23,42,0.04)`), the standard "just enough to separate from the page" SaaS convention. No heavy elevation, no dark surfaces to create contrast-based depth.

## Shapes

Standard rounded corners throughout: `8px` on buttons/inputs, `12px` on cards/panels/modals, fully rounded (`rounded-full`) on status pills and avatars. No sharp/rectangular chip system.

## Components

### Buttons
- **Primary:** solid `brand-600` fill, white text, 8px radius. Hover darkens to `brand-700`.
- **Secondary:** white fill, `slate-200` border, `slate-700` text.
- **Destructive:** solid `chip-neg` (`#dc2626`) fill, white text.
- **Ghost:** no fill, `slate-600` text, `slate-100` hover background.

### Chips / Status Pills (`.chip` in globals.css)
- **Style:** soft-tint background, matching darker text, fully rounded, 12px text — the standard pill pattern.
- **Variants:** `.chip-pos` (won/on-track, green), `.chip-neg` (lost/out, red), `.chip-live` (in the pipeline, blue), `.chip-mute` (terminal/inactive, gray).

### Cards / Containers
- **Corner Style:** 12px (`rounded-lg`/`rounded-xl` per Tailwind scale as used).
- **Background:** white.
- **Border:** `slate-200/80` hairline.
- **Shadow:** single low ambient shadow.

### Inputs / Fields
- **Style:** `slate-200` border, white background, 8px radius.
- **Focus:** `brand-400` border + `brand-100` ring.

### Navigation (Sidebar)
- **Style:** white rail, hairline right border, `slate-600` inactive text.
- **Active state:** `brand-50` background tint + `brand-700` text/icon — the standard tinted-background active state, no shell color, no marker bar.
- **Mobile:** full-width drawer with a dark semi-transparent backdrop (standard modal-scrim convention, not a surface color).

## Do's and Don'ts

### Do:
- **Do** keep the sidebar and topbar white with a hairline border.
- **Do** use `brand-600`/`brand-700` as the only accent, always paired with white text on solid fills.
- **Do** use soft-tint rounded-full pills for every status/lifecycle badge.
- **Do** keep IBM Plex Mono to codes, phone numbers, and counts.

### Don't:
- **Don't** reintroduce a dark or colored sidebar/topbar shell.
- **Don't** use a solid, high-contrast block for a status badge — always the soft-tint pill.
- **Don't** introduce a second accent color (gold, purple, etc.) competing with blue.
- **Don't** put dark text on the accent fill, or white text on a light accent tint — check contrast per pairing above.
