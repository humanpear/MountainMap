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
