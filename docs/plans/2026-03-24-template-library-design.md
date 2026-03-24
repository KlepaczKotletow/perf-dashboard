# Template Library Design

**Date:** 2026-03-24
**Status:** Approved

## Problem

Templates are limited to review questions. Platform needs competency frameworks and cycle profiles like Lattice/Culture Amp.

## Design

### DB-stored library with 3 template types

Extend `templates` table with `template_type` column: "review" | "competency_framework" | "cycle_profile". Add `content` JSONB column for structured data per type.

### Templates page becomes tabbed library

3 tabs: Review Templates | Competency Frameworks | Cycle Profiles. Cards with preview + Import/Use buttons.

### Content

**4 Competency Frameworks:**
1. Engineering Ladder (8 competencies, 5 levels)
2. Product Management (6 competencies)
3. People Management (6 competencies)
4. General / SHRM-style (6 competencies)

**4 Cycle Profiles:**
1. Annual Performance Review
2. Quarterly Check-in
3. 90-Day Probation
4. Manager 360 Feedback

**6 Review Templates (existing, improved).**

### Integration points
- Competency frameworks: "Import" → creates competencies in workspace
- Cycle profiles: picker in cycle wizard Step 1 pre-fills type + description, Step 3 pre-fills questions
- Review templates: already integrated in Step 3

Sources:
- [Lattice Competency Library](https://help.lattice.com/hc/en-us/articles/4403424981783-The-Competency-Library)
- [Lattice Track Templates](https://help.lattice.com/hc/en-us/articles/4402717644183-Track-Templates)
