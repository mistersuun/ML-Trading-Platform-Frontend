.PHONY: check
# Same steps as .github/workflows/ci.yml (lint is blocking).
check:
	npm ci
	npm run api:check
	npm run lint
	npm run typecheck
	npm test
	npm run build
