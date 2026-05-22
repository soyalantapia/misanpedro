#!/usr/bin/env node
// Build del API con esbuild:
// - Bundlea @misanpedro/shared al output (workspace dep)
// - Mantiene todas las deps de runtime (hono, mongoose, etc.) como external
//   → más rápido + más liviano que tener todo inline
// - Resuelve `@/*` automáticamente (lee tsconfig.json paths)
// - Output ESM (matchea `"type": "module"` del package.json)
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
const deps = Object.keys(pkg.dependencies ?? {})

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  // Externals: todo lo del package.json salvo @misanpedro/* (workspace deps)
  external: deps.filter((d) => !d.startsWith('@misanpedro/')),
  // Compat con CJS deps desde ESM (mongoose, etc.)
  banner: {
    js: `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);`,
  },
  // Quita el código fuente de los console.logs en prod
  minify: false,
  sourcemap: 'linked',
  logLevel: 'info',
  tsconfig: 'tsconfig.json',
})
