import fs from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const envContent = fs.readFileSync('.env.local', 'utf-8')

function parseEnv(key) {
  const lines = envContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`${key}=`)) {
      let val = trimmed.slice(key.length + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      return val.replace(/\\n/g, '\n').trim()
    }
  }
  return ''
}

const clientEmail = parseEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
const privateKey = parseEnv('FIREBASE_ADMIN_PRIVATE_KEY')
const projectId = parseEnv('VITE_FIREBASE_PROJECT_ID') || 'the-commonplace-f8eeb'

if (!clientEmail || !privateKey) {
  console.error('Missing Firebase Admin credentials in .env.local')
  process.exit(1)
}

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
})

const db = getFirestore(app)
const auth = getAuth(app)

async function main() {
  const [authUsers, usersSnap, postsSnap, followsSnap, reqSnap, reportsSnap] = await Promise.all([
    auth.listUsers(100),
    db.collection('users').get(),
    db.collection('posts').get(),
    db.collection('follows').get(),
    db.collection('follow-requests').get(),
    db.collection('reports').get(),
  ])

  console.log('--- FIREBASE DATA INVENTORY ---')
  console.log('Auth Users count:', authUsers.users.length)
  authUsers.users.forEach((u) => {
    console.log(`  Auth User: uid=${u.uid} | email=${u.email} | name=${u.displayName}`)
  })

  console.log('\nFirestore `users` docs:', usersSnap.size)
  usersSnap.docs.forEach((d) => {
    const data = d.data()
    console.log(`  User Doc: id=${d.id} | handle=${data.handle} | name=${data.firstName} ${data.lastName}`)
  })

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id
    const userEntriesSnap = await db.collection('users').doc(userId).collection('entries').get()
    const userMediaSnap = await db.collection('users').doc(userId).collection('media').get()
    const userCollectionsSnap = await db.collection('users').doc(userId).collection('created-collections').get()
    console.log(`\nUser [${userId}] (${userDoc.data().handle}):`)
    console.log(`  entries: ${userEntriesSnap.size}`)
    if (userEntriesSnap.size > 0) {
      console.log('  sample full entry:', JSON.stringify(userEntriesSnap.docs[0].data(), null, 2))
    }
    console.log(`  media docs: ${userMediaSnap.size}`)
    console.log(`  created collections: ${userCollectionsSnap.size}`)
  }

  console.log('\nFirestore `follows` docs:', followsSnap.size)
  followsSnap.docs.forEach((d) => {
    console.log(`  Follow: ${d.id}`, d.data())
  })

  console.log('\nFirestore `follow-requests` docs:', reqSnap.size)
  console.log('Firestore `reports` docs:', reportsSnap.size)
}

main().catch(console.error)
