## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Portfolio mentoring

The learner writes and changes the website code. Guide them through the complete project, explain concepts, and review their daily progress. Prefer explanations, targeted hints, and debugging exercises. Install additional skills only when a concrete need arises.

Graphify is installed in this project's isolated .tools/graphify environment. In PowerShell, invoke it with:
`& 'D:\Programming\Portfolio\.tools\graphify\Scripts\python.exe' -m graphify <command>`
Use this interpreter for Graphify instructions instead of installing another global copy. No portfolio graph exists yet; generate one when the learner has source files to review. Exclude the tool environment and installed skill files from portfolio analysis.
