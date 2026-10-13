// Refuses to continue unless Firebase targets only the CAV project.
import { readFileSync } from 'node:fs'
const ALLOWED = 'cav-madagascar-b4beb'
const FORBIDDEN = 'e-learning-b2434'
const rc = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
const targets = Object.values(rc.projects ?? {})
const problems = []
if (rc.projects?.default !== ALLOWED) problems.push(`.firebaserc default is "${rc.projects?.default}", expected "${ALLOWED}"`)
for (const t of targets) if (t !== ALLOWED) problems.push(`.firebaserc contains foreign project "${t}"`)
if (process.argv.slice(2).some(a => a.includes(FORBIDDEN))) problems.push(`argument references ${FORBIDDEN}`)
for (const v of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT']) {
  if (process.env[v] && process.env[v] !== ALLOWED) problems.push(`env ${v}="${process.env[v]}" is not ${ALLOWED}`)
}
if (problems.length) {
  console.error('DEPLOY BLOCKED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log(`OK: Firebase target is ${ALLOWED}`)
