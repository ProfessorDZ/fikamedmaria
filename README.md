# claude-mode

My Claude experiments

## Installed Agent Skills

Skills from [anthropics/skills](https://github.com/anthropics/skills) are vendored
under `.claude/skills/`. Claude Code automatically discovers them in any session
opened in this repo and invokes them when a task matches their description.

### Document skills
- **docx** — create, read, and edit Word documents
- **pdf** — read, extract, and manipulate PDF files
- **pptx** — create and edit PowerPoint presentations
- **xlsx** — create and edit Excel spreadsheets

### Example skills
- **algorithmic-art** — generative art with p5.js and seeded randomness
- **brand-guidelines** — apply Anthropic's brand colors and typography
- **canvas-design** — visual art as .png / .pdf documents
- **claude-api** — Claude API & SDK reference for building LLM apps
- **doc-coauthoring** — structured documentation co-authoring workflow
- **frontend-design** — distinctive, intentional UI visual design
- **internal-comms** — internal communication templates
- **mcp-builder** — build high-quality MCP servers
- **skill-creator** — create, improve, and measure skills
- **slack-gif-creator** — animated GIFs optimized for Slack
- **theme-factory** — style artifacts (slides, docs, HTML) with a theme
- **web-artifacts-builder** — elaborate multi-component HTML artifacts
- **webapp-testing** — test local web apps with Playwright

To update, re-copy from the upstream repo. To remove a skill, delete its folder
under `.claude/skills/`.
