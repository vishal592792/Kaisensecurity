/**
 * Application Configuration & Environment Variables
 * Kaisen SECURE ADMIN Platform
 * Owner: Vishal Chaudhary
 */

export const APP_CONFIG = {
  name: 'Kaisen SECURE ADMIN',
  productName: 'Vishal SecureScan',
  version: '2.4.0',
  owner: {
    name: 'Vishal Chaudhary',
    // Safe server-side or public-site configuration value:
    contact: process.env.OWNER_CONTACT_NUMBER || '+1 (800) 555-KSEN',
    email: process.env.OWNER_EMAIL || 'vishal@kaisensecurity.com',
  },
  security: {
    // HMAC secret used strictly server-side to hash and verify raw client API keys
    apiKeyHmacSecret: process.env.API_KEY_HMAC_SECRET || 'kaisen_super_secret_hmac_key_min_32_bytes_long_entropy_2026',
    jwtSecret: process.env.JWT_SECRET || 'kaisen_secure_jwt_secret_token_entropy_key_change_in_production_2026',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || 'kaisen_admin_session_cookie_secret_entropy_production_2026',
    adminSessionDurationHours: 8,
    clientAccessTokenLifetimeMinutes: 15,
    clientRefreshTokenLifetimeDays: 7,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 15,
  },
  database: {
    url: process.env.DATABASE_URL || '',
    isLocalEmbedded: !process.env.DATABASE_URL,
  },
  integrity: {
    enforcePlayIntegrity: process.env.ENFORCE_PLAY_INTEGRITY === 'true',
    expectedPackageName: process.env.EXPECTED_PACKAGE_NAME || 'com.vishal.securescan',
    expectedSigningCertSha256: process.env.EXPECTED_CERT_SHA256 || 'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90',
  }
};
