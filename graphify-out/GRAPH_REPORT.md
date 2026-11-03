# Graph Report - Portfolio  (2026-10-11)

## Corpus Check
- 18 files · ~225,188 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 1, .blend 1, .glb 1)

## Summary
- 45 nodes · 45 edges · 11 communities (2 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- verify-overlay.cjs
- diagram
- AGENTS.md
- resolve
- black-hole/README.md
- paragraph
- spline-scroll/README.md

## God Nodes (most connected - your core abstractions)
1. `diagram()` - 4 edges
2. `resolve()` - 4 edges
3. `paragraph()` - 3 edges
4. `font_run()` - 2 edges
5. `center()` - 2 edges
6. `box()` - 2 edges
7. `arrow()` - 2 edges
8. `fs` - 1 edges
9. `path` - 1 edges
10. `vm` - 1 edges

## Surprising Connections (you probably didn't know these)
- `paragraph()` --calls--> `resolve()`  [EXTRACTED]
  deliverables/hft_case_study/work/build_report.py → deliverables/hft_case_study/work/build_report.py  _Bridges community 5 → community 7_

## Import Cycles
- None detected.

## Communities (11 total, 9 thin omitted)

### Community 1 - "verify-overlay.cjs"
Cohesion: 0.22
Nodes (4): assert, fs, path, vm

### Community 3 - "diagram"
Cohesion: 0.50
Nodes (4): diagram(), arrow(), box(), center()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `diagram()` connect `diagram` to `build_report.py`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `resolve()` connect `resolve` to `build_report.py`, `paragraph`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._