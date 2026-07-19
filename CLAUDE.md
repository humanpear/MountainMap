# MountianMap Agent Notes

## Design System

Always read `DESIGN.md` before making visual or UI decisions.

All font choices, colors, spacing, marker language, motion, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA or review mode, flag UI that does not match `DESIGN.md`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Release/deploy → invoke /ship or /land-and-deploy
- Security audit → invoke /cso
- Performance regression → invoke /benchmark
- Documentation → invoke /document-generate or /document-release
- Resume context → invoke /context-restore

## Health Stack

- typecheck: npm run lint
- test: npm test

## Project documentation

- [`AGENTS.md`](./AGENTS.md): workspace agent instructions
- [`CHANGELOG.md`](./CHANGELOG.md): release history
- [`DESIGN.md`](./DESIGN.md): product design system and responsive rules
- [`PROJECT_DATA_NOTES.md`](./PROJECT_DATA_NOTES.md): source and runtime data policies
- [`GSTACK_CODEX_USAGE.md`](./GSTACK_CODEX_USAGE.md): local gstack usage guide
- [`pibma-nogit-design-20260506-165651.md`](./pibma-nogit-design-20260506-165651.md): original random-centered MVP design record
- [`docs/mountain-guide-data-workflow.md`](./docs/mountain-guide-data-workflow.md): mountain guide data workflow
- [`docs/my-page-b-implementation-plan.md`](./docs/my-page-b-implementation-plan.md): My Page B implementation record
- [`docs/mountain-discovery-implementation-workflow.md`](./docs/mountain-discovery-implementation-workflow.md): mountain discovery implementation and release record
