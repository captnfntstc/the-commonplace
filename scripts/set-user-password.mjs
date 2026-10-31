import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

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

const supabaseUrl = parseEnv('VITE_SUPABASE_URL')
const serviceRoleKey = parseEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.log('Usage: node scripts/set-user-password.mjs <email> <new-password>')
  console.log('Example: node scripts/set-user-password.mjs jpatpatrojas@gmail.com mySecretPass123')
  process.exit(1)
}

async function main() {
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error fetching users:', listError.message)
    process.exit(1)
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`User with email "${email}" not found in Supabase!`)
    console.log('Available emails:')
    usersData.users.forEach((u) => console.log(` - ${u.email}`))
    process.exit(1)
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateError) {
    console.error('Failed to set password:', updateError.message)
    process.exit(1)
  }

  console.log(`✓ Password successfully updated for ${user.email} (${user.user_metadata?.handle || user.id})!`)
}

main().catch(console.error)
