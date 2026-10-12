# Kaisen SECURE ADMIN — Vishal SecureScan Administration Platform

Production-oriented web-based administration platform for **Vishal SecureScan**.

- **Owner**: Vishal Chaudhary
- **Configurable Contact**: `+1 (800) 555-KSEN` (configured via `OWNER_CONTACT_NUMBER` environment variable)
- **Product**: Kaisen SECURE ADMIN (v2.4.0)
- **Architecture**: Zero-Trust Server-Enforced Security, Hardware-Scoped Device Binding, HMAC Verifiers, RFC 6238 TOTP Multi-Factor Authentication.

---

## 1. Core Architecture & Security Model

1. **Cryptographic API-Key Lifecycle**:
   - High-entropy 256-bit keys generated via OS CSPRNG (`crypto.randomBytes`).
   - Prefix: `ksk_live_`. Unique internal ID: `ksk_id_<hex>`.
   - **Zero Plaintext Storage**: Full raw key is displayed **EXACTLY ONCE** upon issuance. Only a server-side keyed HMAC-SHA256 verifier (`key_hmac`) is stored in the database.
   - Verification is executed strictly in constant time (`crypto.timingSafeEqual`).
   - Server-side status checks (`active`, `suspended`, `revoked`, `expired`). Revocation is permanent.

2. **Hardware-Scoped Device Management**:
   - Random, app-scoped installation identifier (`app_installation_id`). No invasive hardware identifiers (IMEI, serial numbers, contacts).
   - Configurable per-key maximum device threshold.
   - Device revocation instantly propagates to all subsequent API authorization requests.

3. **Administrator Authentication**:
   - Dedicated administrator login segregated from client API keys.
   - Password hashing with **Argon2id** (`m=19456`, `t=2`, `p=1`).
   - **Mandatory MFA** for privileged accounts using **RFC 6238 TOTP** and cryptographically hashed single-use recovery codes.
   - Brute-force rate limiting and automated temporary account lockouts.
   - Session tokens managed via server-controlled `HttpOnly`, `SameSite=Lax`, `Secure` cookies with instant revocation.

4. **Application Integrity & Anti-Tampering Engine**:
   - Server-side Play Integrity evaluation (`STRICT`, `PERMISSIVE`, `MONITOR_ONLY` rollout policies).
   - Semantic versioning verification against configurable minimum app thresholds.
   - Package identity and signing-certificate SHA-256 fingerprint verification.

5. **Client Session & Token Rotation**:
   - Short-lived Access Tokens (15 minutes).
   - Refresh Token Rotation with automated reuse detection: any replay of a revoked refresh token triggers immediate revocation of the entire token family and flags a critical security incident.

---

## 2. Admin Panel Design & Modules

The platform features an enterprise dark cybersecurity theme and accessible light theme with 12 unified modules:

1. **Overview Dashboard**: Live database-backed metrics, 7-day scan submission and risk finding SVG trend graphs, zero-trust enforcement matrix, and live feeds.
2. **API-Key Management**: Searchable key inventory, creation modal with explicit secret reveal/copy flow, status filters, device limits, quota controls, suspend/resume, replacement, and permanent revocation.
3. **User Management**: Tenant directory, device count, associated key lists, and instant suspension controls.
4. **Registered Devices**: Bound Android installations, Play Integrity verdicts, app versions, last seen timestamps, and remote revocation.
5. **Authentication Logs**: Detailed audit log of every authentication trial with outcomes, failure reasons, and IP tracking.
6. **Integrity Events**: Anti-tampering and hardware verdict anomalies with technical telemetry inspector and status workflows (`NEW`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`).
7. **Scan Reports**: Assessment report registry, findings breakdown by severity, confidence metrics, and privacy-redacted JSON export.
8. **Threat Intelligence**: Integration settings for VirusTotal, AlienVault OTX, AbuseIPDB, and Kaisen Feed with live connection test tooling.
9. **Security Policies**: Live policy editor (rate limits, device limits, integrity policy modes, maintenance mode) with versioned changelog.
10. **Notifications**: Alert feed with unread count, mark-as-read actions, and configurable deduplication thresholds.
11. **Audit Trail**: Append-only immutable administrative ledger with redacted context inspector and CSV export.
12. **Settings**: Super Administrator profile, owner identity, Argon2id password rotation, and active session manager with remote revocation.

---

## 3. Administrator Provisioning

Administrator accounts cannot be registered via public forms. Initial provisioning is strictly handled via the documented CLI utility:

```bash
# Provision a Super Administrator with random password or explicit password
npx tsx scripts/provision-admin.ts --username superadmin --email admin@kaisensecurity.com --password "YourStrongPassword#2026!"
```

The script outputs:
- Administrator ID (`adm_...`)
- Argon2id password hash confirmation
- RFC 6238 Base32 TOTP secret and Authenticator URI
- 8 cryptographically hashed backup recovery codes

---

## 4. API Endpoints Reference

### Client Android Scanner Endpoints
- `POST /api/v1/auth/login` — Client login with API key, device ID, app version, and integrity token
- `POST /api/v1/auth/refresh` — Refresh token rotation with reuse detection
- `POST /api/v1/auth/logout` — Revoke client session
- `GET /api/v1/auth/session` — Verify active access token
- `POST /api/v1/integrity/verify` — Validate app integrity evidence
- `GET /api/v1/config` — Public server configuration & minimum app version
- `POST /api/v1/scans` — Submit client scan report
- `POST /api/v1/scans/:scanId/findings` — Submit scan findings
- `GET /api/v1/scans/:scanId` — Retrieve scan report details
- `GET /api/v1/app-status` — Operational health & database latency

### Administrator Endpoints (Protected by Admin Session Cookie / Bearer Token)
- `POST /api/v1/admin/auth/login` — Phase 1 password verification
- `POST /api/v1/admin/auth/mfa` — Phase 2 TOTP or recovery code challenge
- `GET /api/v1/admin/auth/me` — Current admin user profile
- `POST /api/v1/admin/auth/logout` — Revoke admin session
- `GET /api/v1/admin/overview` — Dashboard live metrics
- `GET /api/v1/admin/keys` — List API keys with pagination & search
- `POST /api/v1/admin/keys` — Issue new API key (returns raw key once)
- `GET /api/v1/admin/keys/:keyId` — Retrieve key metadata
- `POST /api/v1/admin/keys/:keyId/suspend` — Suspend key
- `POST /api/v1/admin/keys/:keyId/resume` — Resume suspended key
- `POST /api/v1/admin/keys/:keyId/revoke` — Permanently revoke key
- `POST /api/v1/admin/keys/:keyId/replace` — Issue replacement key
- `GET /api/v1/admin/users` — List tenant users
- `POST /api/v1/admin/users` — Create tenant user
- `POST /api/v1/admin/users/:userId/suspend` — Suspend user
- `POST /api/v1/admin/users/:userId/reactivate` — Reactivate user
- `GET /api/v1/admin/devices` — List bound devices
- `POST /api/v1/admin/devices/:deviceId/revoke` — Revoke device installation
- `GET /api/v1/admin/auth-logs` — Authentication event logs
- `GET /api/v1/admin/events` — Integrity and tamper events
- `PATCH /api/v1/admin/events/:eventId` — Update incident status
- `GET /api/v1/admin/scans` — Scan reports list
- `GET /api/v1/admin/scans/:scanId` — Scan report findings
- `GET /api/v1/admin/policies` — Active policies and version changelog
- `PATCH /api/v1/admin/policies/:policyId` — Update security policy
- `GET /api/v1/admin/threat-intel` — Threat intel provider configurations
- `PATCH /api/v1/admin/threat-intel/:providerId` — Update provider settings
- `POST /api/v1/admin/threat-intel/:providerId/test` — Test provider connectivity
- `GET /api/v1/admin/notifications` — Notification list
- `POST /api/v1/admin/notifications/:id/read` — Mark notification read
- `POST /api/v1/admin/notifications/mark-all-read` — Mark all read
- `GET /api/v1/admin/notifications/settings` — Notification preferences
- `PATCH /api/v1/admin/notifications/settings` — Update preferences
- `GET /api/v1/admin/audit` — Append-only audit trail
- `GET /api/v1/admin/settings` — Platform settings & active sessions
- `POST /api/v1/admin/settings/password` — Change admin password
- `DELETE /api/v1/admin/settings/sessions/:sessionId` — Revoke admin session

---

## 5. Local Development Setup

### Prerequisites
- Node.js 20+ / 22+
- npm or pnpm

### Installation & Execution
```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Seed realistic operational database records
npx tsx scripts/seed-data.ts

# 4. Provision or verify Super Administrator
npx tsx scripts/provision-admin.ts --username superadmin --email admin@kaisensecurity.com --password "KaisenAdmin@2026!"

# 5. Run automated test suite
npm test

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the console.

---

## 6. Production Deployment Instructions

### Option A: Managed VPS (Ubuntu / Debian with Systemd & Nginx)

1. **System Dependencies**:
   ```bash
   sudo apt update && sudo apt install -y nodejs npm postgresql postgresql-contrib nginx certbot python3-certbot-nginx
   ```

2. **PostgreSQL Configuration**:
   ```sql
   CREATE DATABASE kaisen_securescan;
   CREATE USER kaisen_admin WITH ENCRYPTED PASSWORD 'StrongProductionPassword';
   GRANT ALL PRIVILEGES ON DATABASE kaisen_securescan TO kaisen_admin;
   ```

3. **Deploy Application**:
   ```bash
   git clone <repo-url> /var/www/kaisen-admin
   cd /var/www/kaisen-admin
   npm ci
   cp .env.example .env
   # Edit .env with production database credentials, strong HMAC secrets, and owner contact
   npm run build
   ```

4. **Systemd Service (`/etc/systemd/system/kaisen-admin.service`)**:
   ```ini
   [Unit]
   Description=Kaisen SECURE ADMIN Next.js Service
   After=network.target postgresql.service

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/kaisen-admin
   ExecStart=/usr/bin/npm start
   Restart=always
   Environment=NODE_ENV=production
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now kaisen-admin
   ```

5. **Nginx Reverse Proxy with SSL**:
   ```nginx
   server {
       server_name admin.kaisensecurity.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo certbot --nginx -d admin.kaisensecurity.com
   ```

---

## 7. Database Backup & Disaster Recovery

### Scheduled Backup Cron
```bash
# Automated daily UTC backup
pg_dump -U kaisen_admin -h localhost -d kaisen_securescan | gzip > /var/backups/kaisen/kaisen_securescan_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```

### Disaster Restoration
```bash
gunzip -c /var/backups/kaisen/kaisen_securescan_YYYYMMDD.sql.gz | psql -U kaisen_admin -h localhost -d kaisen_securescan
```

---

## 8. Automated Test Results

The suite tests:
- API-key generation, entropy, and prefixing.
- Constant-time HMAC verification.
- Argon2id password hashing and comparison.
- RFC 6238 TOTP verification and backup recovery code single-use consumption.
- Rate limiting window expiration and resets.
- Role-based access control (Super Admin, Security Admin, Read-Only Analyst).
- Semantic version comparison and Play Integrity policy modes (`STRICT`, `PERMISSIVE`, `MONITOR_ONLY`).
- Full End-to-End lifecycle: Provision key -> Register device -> Issue session -> Token rotation -> Token replay reuse detection -> User suspension block -> Device revocation block -> Key revocation block.

```bash
npm test
```
Result: **4 test files passed (17 tests total, 100% pass rate)**.
