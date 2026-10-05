.PHONY: check
# Same steps as .github/workflows/ci.yml. Lint has 5 pre-existing app errors (Settings.tsx), so it is non-blocking
# here as in CI; remove the leading '-' once they are fixed.
check:
	npm ci
	-npm run lint
	npm run typecheck
	npm test
	npm run build
