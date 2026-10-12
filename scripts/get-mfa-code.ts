/**
 * Utility to generate current 6-digit TOTP MFA code for administrator
 * Usage: npm run mfa
 */

import * as OTPAuth from 'otpauth';
import { query } from '../src/lib/db';

async function main() {
  const res = await query(
    `SELECT a.username, m.totp_secret, m.recovery_codes_hash 
     FROM administrators a 
     JOIN administrator_mfa m ON a.id = m.admin_id 
     LIMIT 1`
  );

  if (res.rows.length === 0) {
    console.log('No administrator with MFA configured found in database.');
    process.exit(1);
  }

  const admin = res.rows[0];
  const totp = new OTPAuth.TOTP({
    issuer: 'Kaisen SECURE ADMIN',
    label: admin.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(admin.totp_secret)
  });

  const code = totp.generate();
  const secondsRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  console.log('\n======================================================');
  console.log('   KAISEN SECURE ADMIN — 6-DIGIT MFA AUTHENTICATOR    ');
  console.log('======================================================\n');
  console.log(`  Administrator:   ${admin.username}`);
  console.log(`  CURRENT 6-DIGIT CODE:  👉  ${code}  👈`);
  console.log(`  Valid for:       ${secondsRemaining} seconds`);
  console.log('\n------------------------------------------------------');
  console.log('  TOTP Secret Key (Base32):');
  console.log(`  ${admin.totp_secret}`);
  console.log('  (You can add this secret to Google Authenticator or 1Password)');
  console.log('======================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
