import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const docs = fileURLToPath(new URL('../docs/', import.meta.url))
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
mkdirSync(docs, { recursive: true })
cpSync(dist, docs, { recursive: true })
writeFileSync(new URL('../docs/.nojekyll', import.meta.url), '')
console.log('GitHub Pages files prepared in docs/')
