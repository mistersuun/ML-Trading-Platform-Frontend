import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Renaming a response field in openapi.json and regenerating schema.d.ts must make `tsc` fail, because
 * the pages read that field. Done on a scratch copy so the real schema is never touched.
 * (Manual equivalent: edit src/api/openapi.json, `npm run api:gen`, `npm run typecheck`.)
 */
describe('schema drift', () => {
  it('renaming PatternListResponse.patterns breaks the typecheck', () => {
    const root = resolve(__dirname, '../../..')
    const tmp = resolve(root, '.schema-drift-tmp')
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp, { recursive: true })
    try {
      cpSync(resolve(root, 'src'), resolve(tmp, 'src'), {
        recursive: true,
        filter: (p) => !p.includes('__tests__') && !p.includes('/test'),
      })
      const specPath = resolve(tmp, 'src/api/openapi.json')
      const spec = JSON.parse(readFileSync(specPath, 'utf8'))
      const schema = spec.components.schemas.PatternListResponse
      schema.properties.pattern_names = schema.properties.patterns
      delete schema.properties.patterns
      schema.required = schema.required.map((r: string) => (r === 'patterns' ? 'pattern_names' : r))
      writeFileSync(specPath, JSON.stringify(spec))

      const bin = (name: string) => resolve(root, 'node_modules/.bin', name)
      execFileSync(bin('openapi-typescript'), [specPath, '-o', resolve(tmp, 'src/api/schema.d.ts'), '--default-non-nullable', 'false'], { cwd: root })
      writeFileSync(resolve(tmp, 'tsconfig.json'), JSON.stringify({
        extends: '../tsconfig.app.json',
        compilerOptions: { tsBuildInfoFile: './.tsbuildinfo' },
        include: ['src'],
      }))
      let out = ''
      try {
        execFileSync(bin('tsc'), ['-p', resolve(tmp, 'tsconfig.json'), '--noEmit'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
      } catch (e) {
        out = String((e as { stdout?: string }).stdout ?? e)
      }
      expect(out).toMatch(/error TS\d+/)
      expect(out).toMatch(/patterns/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }, 120_000)
})
