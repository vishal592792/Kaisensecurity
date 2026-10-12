/**
 * Administrator Provisioning CLI Script
 * Securely provisions the initial Super Administrator with Argon2id and TOTP MFA
 * Usage: npx tsx scripts/provision-admin.ts [--username admin] [--email admin@example.com]
 */

import crypto from 'crypto';
import { hashPassword, hashToken } from '../src/lib/auth/password';
import { generateTotpSetup } from '../src/lib/auth/totp';
import { query, runMigrations } from '../src/lib/db';

async function main() {
  console.log('\n=============================================================');
  console.log('   KAISEN SECURE ADMIN — SUPER ADMIN PROVISIONING UTILITY    ');
  console.log('=============================================================\n');

  await runMigrations();

  const args = process.argv.slice(2);
  let username = 'admin';
  let email = 'admin@kaisensecurity.com';
  let password = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && args[i + 1]) username = args[i + 1];
    if (args[i] === '--email' && args[i + 1]) email = args[i + 1];
    if (args[i] === '--password' && args[i + 1]) password = args[i + 1];
  }

  // Check if admin with this username or email already exists
  const existing = await query(
    `SELECT id, username, email FROM administrators WHERE username = $1 OR email = $2`,
    [username, email]
  );

  if (existing.rows.length > 0) {
    console.log(`[!] Notice: Administrator '${username}' (${email}) already exists.`);
    console.log(`    ID: ${existing.rows[0].id}`);
    process.exit(0);
  }

  // Generate strong random password if not supplied
  if (!password) {
    const randomBytes = crypto.randomBytes(16).toString('base64url');
    password = `Ksn#${randomBytes}!9A`;
  }

  console.log('[+] Hashing password with Argon2id (m=19456, t=2, p=1)...');
  const passwordHash = await hashPassword(password);
  const adminId = `adm_${crypto.randomBytes(8).toString('hex')}`;

  console.log('[+] Generating RFC 6238 TOTP MFA secret and backup recovery codes...');
  const totpSetup = await generateTotpSetup(username, 'Kaisen SECURE ADMIN');

  // Insert administrator
  await query(
    `INSERT INTO administrators (
      id, username, email, password_hash, role, is_active, mfa_enabled, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [adminId, username, email, passwordHash]
  );

  // Insert administrator MFA
  await query(
    `INSERT INTO administrator_mfa (
      admin_id, totp_secret, recovery_codes_hash, confirmed_at, created_at
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [adminId, totpSetup.secret, JSON.stringify(totpSetup.hashedRecoveryCodes)]
  );

  console.log('\n[✔] SUCCESS: Super Administrator provisioned successfully!\n');
  console.log('-------------------------------------------------------------');
  console.log(`  Admin ID:       ${adminId}`);
  console.log(`  Role:           SUPER_ADMIN`);
  console.log(`  Username:       ${username}`);
  console.log(`  Email:          ${email}`);
  console.log(`  Password:       ${password}`);
  console.log('-------------------------------------------------------------');
  console.log('  MFA TOTP Secret (Base32):');
  console.log(`  ${totpSetup.secret}`);
  console.log('  MFA Authenticator URI:');
  console.log(`  ${totpSetup.uri}`);
  console.log('-------------------------------------------------------------');
  console.log('  Backup Recovery Codes (Keep in a secure vault):');
  totpSetup.recoveryCodes.forEach((code, idx) => {
    console.log(`    [${idx + 1}] ${code}`);
  });
  console.log('-------------------------------------------------------------\n');
  console.log('[!] IMPORTANT: Store the password, TOTP secret, and recovery codes now.');
  console.log('    They will NEVER be displayed again in plaintext.\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('[X] Provisioning failed:', err);
  process.exit(1);
});
