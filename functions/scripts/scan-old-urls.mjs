// Scans Firestore for references to the legacy project/bucket.
// DRY RUN by default: reads only, writes a path-only report to scripts-output/.
// Usage (from functions/, with Application Default Credentials for the NEW project):
//   node scripts/scan-old-urls.mjs
//   node scripts/scan-old-urls.mjs --apply --confirm-backup --new-bucket <new-bucket-name>
import { mkdirSync, writeFileSync } from 'node:fs'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const NEW_PROJECT = 'cav-madagascar-b4beb'
const OLD_PROJECT = 'e-learning-b2434'
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const newBucket = args.includes('--new-bucket') ? args[args.indexOf('--new-bucket') + 1] : ''
const OLD_BUCKET_RE = new RegExp(`${OLD_PROJECT}(?:\\.appspot\\.com|\\.firebasestorage\\.app)`, 'g')
const ANY_OLD_RE = new RegExp(OLD_PROJECT, 'g')

export function findOld(value) { return typeof value === 'string' && ANY_OLD_RE.test(value.replace(/^/, '')) && !(ANY_OLD_RE.lastIndex = 0) }
export function rewrite(value, bucket) { return value.replace(OLD_BUCKET_RE, bucket) }

function walk(value, path, hits) {
  if (typeof value === 'string') { ANY_OLD_RE.lastIndex = 0; if (ANY_OLD_RE.test(value)) hits.push(path); ANY_OLD_RE.lastIndex = 0; return }
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`, hits))
  if (value && typeof value === 'object' && !(typeof value.toDate === 'function') && !('path' in value && 'firestore' in value)) {
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, hits)
  }
}
function rebuild(value, bucket) {
  if (typeof value === 'string') return rewrite(value, bucket)
  if (Array.isArray(value)) return value.map(v => rebuild(v, bucket))
  if (value && typeof value === 'object' && !(typeof value.toDate === 'function') && !('path' in value && 'firestore' in value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebuild(v, bucket)]))
  }
  return value
}

async function scanCollection(col, report, db) {
  for (const doc of (await col.get()).docs) {
    const hits = []
    walk(doc.data(), '', hits)
    if (hits.length) {
      report.push({ doc: doc.ref.path, fields: hits })
      if (apply) {
        const data = doc.data()
        const patch = Object.fromEntries(hits.map(h => h.split(/[.[]/)[0]).filter((v, i, a) => a.indexOf(v) === i).map(top => [top, rebuild(data[top], newBucket)]))
        await doc.ref.update(patch)
      }
    }
    for (const sub of await doc.ref.listCollections()) await scanCollection(sub, report, db)
  }
}

if (process.argv[1] && process.argv[1].endsWith('scan-old-urls.mjs')) {
  const app = initializeApp()
  const projectId = app.options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  if (projectId !== NEW_PROJECT) { console.error(`Refusing to run: project is "${projectId}", expected "${NEW_PROJECT}". Set GOOGLE_CLOUD_PROJECT=${NEW_PROJECT}.`); process.exit(1) }
  if (apply && (!args.includes('--confirm-backup') || !newBucket || newBucket.includes(OLD_PROJECT))) {
    console.error('--apply requires --confirm-backup (Firestore export taken) and --new-bucket <new bucket, not the old one>.'); process.exit(1)
  }
  const db = getFirestore()
  const report = []
  for (const col of await db.listCollections()) await scanCollection(col, report, db)
  mkdirSync('scripts-output', { recursive: true })
  writeFileSync('scripts-output/old-url-report.json', JSON.stringify(report, null, 2))
  console.log(`${apply ? 'APPLIED' : 'DRY RUN'}: ${report.length} document(s) reference ${OLD_PROJECT}. Report: functions/scripts-output/old-url-report.json`)
}
