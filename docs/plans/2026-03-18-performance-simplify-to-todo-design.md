# Performance Page — Remove Results Tab & Restyle to Feedback Look

**Date:** 2026-03-18
**Status:** Approved

## What We're Building

Simplify the Performance page from a two-tab layout (Results + To Do) to a single flat page with three collapsible sections, styled to match the Feedback tab's visual language.

## Why

The Results tab duplicated content already visible on the Feedback tab (review ratings). The Feedback tab's row-based layout is cleaner and more readable than the individual boxed cards used in the current Performance page. Keeping both tabs created confusion about where to look.

## After This Change

- **Performance page** = To Do only. Three collapsible sections: Self-Review, Reviews to Give, Upward Feedback.
- **Feedback page** = All review output: review ratings + continuous feedback.

## Layout

No tabs. Flat page with:

```
<h1>Performance</h1>
<p>subtitle</p>

<CollapsibleSection title="Self-Review" ...>
  <Card>                          ← single card per section
    <CardContent>
      <div className="divide-y divide-border">
        <div className="py-3.5 first:pt-0 last:pb-0"> ... </div>  ← one row per item
      </div>
    </CardContent>
  </Card>
</CollapsibleSection>

<CollapsibleSection title="Reviews to Give" ...>
  <Card> ... </Card>
</CollapsibleSection>

<CollapsibleSection title="Upward Feedback" ...>
  <Card> ... </Card>
</CollapsibleSection>
```

## Row Content (per item, Feedback style)

Each row shows:
- **Left:** Employee name → cycle name (with ArrowRight icon separator), status badge
- **Right:** Deadline date (or review deadline from cycle), action button (Start / Continue / View)

Empty section state: `SectionEmptyNote` component (already exists in collapsible-section.tsx).

## Data

No data-fetching changes. All existing queries in `page.tsx` stay as-is. Only the rendering layer changes.

Sections:
| Section | Source data |
|---|---|
| Self-Review | `pendingSelfReviews` + `completedSelfReviewAssignments` |
| Reviews to Give | `sortedManagerReviews` |
| Upward Feedback | `sortedUpwardReviews` |

## Files

- **Delete:** `src/app/dashboard/performance/performance-tabs-client.tsx` — no longer needed
- **Modify:** `src/app/dashboard/performance/page.tsx` — remove Results tab + tab wrapper, restyle rows to Feedback layout
