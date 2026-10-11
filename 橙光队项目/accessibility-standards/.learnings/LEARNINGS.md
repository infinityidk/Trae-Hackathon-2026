# Learnings

Corrections, insights, and knowledge gaps captured during development.

---

## [LRN-20260522-001] knowledge_gap

**Logged**: 2026-05-22T22:25:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: data

### Summary
Chinese engineering standards have strict rules for mandatory vs recommended clauses based on keywords

### Details
In Chinese engineering standards (GB/SJG/JGJ), the "用词说明" section defines:
- **"应"** (shall) = mandatory, strict requirement → isMandatory=true
- **"宜"** (should) = recommended → isMandatory=false
- **"可"** (may) = optional → isMandatory=false
- **"不应"/"不得"/"严禁"** = mandatory prohibition → isMandatory=true

Additionally:
- **GB 55019-2021** is a "全文强制" (fully mandatory) national standard - ALL clauses are mandatory
- **GB 50763-2012** and **SJG 103-2021** are recommended standards - only "应" clauses are mandatory

The original data had only 2/265 SJG 103 clauses and 5/173 GB 50763 clauses marked as mandatory, when the correct counts are 154/266 and 108/173 respectively.

### Suggested Action
When processing Chinese standards data, always use keyword-based analysis ("应/宜/可") to determine isMandatory flags. For "全文强制" standards, mark all clauses as mandatory.

### Metadata
- Source: user_feedback
- Related Files: data/standards.json
- Tags: chinese-standards, mandatory, accessibility
- Pattern-Key: data.mandatory_flag

---

## [LRN-20260522-002] correction

**Logged**: 2026-05-22T22:25:00+08:00
**Priority**: high
**Status**: resolved
**Area**: data

### Summary
SJG 103-2021 chapter 8 has only 5 sections, not 12; PDF page numbers pointed to 条文说明 not standard text

### Details
The original data for SJG 103 chapter 8 had 12 sections (8.1-8.12) with wrong titles and empty clauses. The actual standard has only 5 sections: 8.1 一般规定, 8.2 居住建筑, 8.3 公共建筑, 8.4 工业建筑, 8.5 其他建筑.

Also, 55 out of 265 clause page numbers pointed to the "条文说明" (explanation) section (pages 55+) instead of the standard text (pages 1-54). This caused PDF jumps to land on wrong pages.

### Suggested Action
Always verify standard data structure against the actual PDF. Use pdfplumber to extract clause numbers and their first-occurrence page numbers from the standard text section only.

### Metadata
- Source: user_feedback
- Related Files: data/standards.json
- Tags: data-quality, page-numbers, pdf
- Pattern-Key: data.page_accuracy

---

## [LRN-20260522-003] best_practice

**Logged**: 2026-05-22T22:25:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
CSS grid-template-rows: 0fr/1fr collapse animation fails with multiple direct children

### Details
The `grid-template-rows: 0fr/1fr` CSS animation technique requires the collapsible container to have exactly ONE direct child element (with `overflow: hidden`). When the container has multiple direct children (e.g., multiple `.outline-section` elements inside `.outline-chapter-body`), the collapse animation doesn't work.

Additionally, `max-height: 0; overflow: hidden` approach also has issues with nested collapsibles - the parent's `overflow: hidden` can clip the child's expanded content.

The simplest reliable approach is `display: none / display: block` with a `fadeIn` animation.

### Suggested Action
For collapsible sections with multiple children or nested collapsibles, use `display: none/block` instead of `grid-template-rows` or `max-height` approaches.

### Metadata
- Source: error
- Related Files: css/style.css
- Tags: css, animation, collapsible
- Pattern-Key: css.collapse_animation

---

## [LRN-20260522-004] correction

**Logged**: 2026-05-22T23:30:00+08:00
**Priority**: critical
**Status**: pending
**Area**: data

### Summary
Partial data verification is insufficient - must verify ALL chapters/sections against PDF

### Details
When asked to verify data completeness, I only checked specific known problem areas (chapter 8, 5.6.1) instead of systematically comparing ALL chapters and sections against the PDF source. User found that 7.4 防护绿地 was missing, which I had missed entirely.

The correct approach is to extract ALL clause numbers from the PDF and compare against the data systematically, not just spot-check.

### Suggested Action
Always do a FULL comparison of PDF clause numbers vs data clause numbers for ALL standards, not just the ones with known issues. Use pdfplumber to extract every clause number from every page and diff against the data.

### Metadata
- Source: user_feedback
- Related Files: data/standards.json
- Tags: data-quality, verification, completeness
- Pattern-Key: data.incomplete_verification

