# Sence.Point Theme — Design Document
*2026-03-19*

## Goal
Apply the Sence.Point visual design system to both the landing page and logged-in dashboard. No functional changes — only colours, typography, border radii, shadows, and opacities.

## Design System (source: Sence.Point screenshots)

### Typography
- **Font**: Manrope (Google Font) — Regular, Medium, Semibold
- Replace current Inter font in `layout.tsx`

### Colour Palette
| Token | Current | New | Hex ref |
|---|---|---|---|
| Background (light) | Warm off-white | Soft lavender | `#ECEEF8` |
| Background (dark sections) | `oklch(0.11_0.014_30)` warm | Deep navy | `#0D0425` |
| Primary accent | Terracotta `oklch(0.55 0.11 35)` | Purple | `#C645F9` |
| Secondary accent | — | Blue-periwinkle | `#5E6CE7` |
| Foreground / text | Warm dark | Deep navy | `#0D0425` |
| Card background | White | White (unchanged) | `#FFFFFF` |
| Border | Warm grey | Light lavender | `#D8DCEF` |
| Sidebar background | Warm off-white | White with lavender tint | `#F5F5FD` |
| Muted background | Warm off-white | Soft lavender tint | `#F0F1FA` |

### Border Radius
- Increase base radius from `0.75rem` → `1rem`

### Shadows
- Cards: soft, light lavender-tinted shadow (currently minimal)

## Files to Change

1. **`src/app/globals.css`** — Replace all CSS variable values in `:root` and `.dark` blocks:
   - Update `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--input`, `--ring`
   - Update all `--sidebar-*` tokens
   - Update `--radius` to `1rem`
   - Update chart colours to purple/blue family

2. **`src/app/layout.tsx`** — Swap font:
   - Remove `Inter` import, add `Manrope`
   - Update font variable assignment

3. **`src/app/page.tsx`** — Update hardcoded dark background classes:
   - `bg-[oklch(0.11_0.014_30)]` → `bg-[#0D0425]`
   - `bg-[oklch(0.13_0.014_30)]` → `bg-[#0D0425]/95`
   - `bg-[oklch(0.16_0.016_30)]` → `bg-[#0D0425]/85`
   - `bg-[oklch(0.17_0.016_30)]` → `bg-[#0D0425]/90`
   - `bg-[oklch(0.25_0.02_280)]` → `bg-[#1a1040]` (Slack mock header)

## Constraints
- No tab names, labels, or component logic changes
- No layout restructuring
- Dark mode variables updated to match the navy/purple family (keep dark mode working)
