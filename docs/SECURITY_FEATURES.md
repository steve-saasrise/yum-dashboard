# Security Features Documentation

## Overview

This document outlines the comprehensive security features implemented for persistent session management in the Daily News dashboard.

## 1. Device Management

### Features

- **Active Session Tracking**: All user sessions are tracked with device information
- **Device Fingerprinting**: Unique identification of devices using browser and OS data
- **Session Revocation**: Users can revoke sessions from untrusted devices
- **Location Tracking**: Geographic tracking of login locations

### Implementation

- **Page**: `/settings/security`
- **Tables**: `device_sessions`, `security_events`
- **API**: `/api/auth/session-tracking`

### Usage

```tsx
// Access the security settings page
<Link href="/settings/security">Manage Devices</Link>
```

## 2. Security Alerts

### Features

- **New Device Alerts**: Email notifications for logins from new devices
- **Suspicious Activity Alerts**: Notifications for unusual login patterns
- **Account Lock Alerts**: Notifications when account is locked due to failed attempts

### Event Types

- `new_device_login`: New device detected
- `suspicious_login`: Login from unusual location
- `concurrent_login`: Multiple simultaneous logins
- `brute_force_attempt`: Multiple failed login attempts
- `account_locked`: Account locked due to security concerns
- `session_revoked`: Session manually revoked by user

### Implementation

- **Service**: `SecurityService.sendSecurityAlert()`
- **Table**: `security_events`

## 3. Risk-Based Re-Authentication

### Features

- **Time-Based Re-Auth**: Require password re-entry after 15 minutes for sensitive actions
- **Protected Actions**: Wrap sensitive operations with re-authentication requirements
- **Sensitivity Levels**: Different re-auth requirements based on action sensitivity

### Sensitive Actions

- **High Security**:
  - Password changes
  - Email changes
  - Billing access
  - Account deletion
  - Security settings changes

- **Medium Security**:
  - Profile updates
  - Privacy settings
  - Data exports

### Implementation

```tsx
import { ProtectedAction } from '@/components/security/protected-action';

// Wrap sensitive actions
<ProtectedAction action={handleSensitiveAction} sensitivityLevel="high">
  <Button>Perform Sensitive Action</Button>
</ProtectedAction>;
```

## 4. Security Monitoring

### Features

- **Failed Login Tracking**: Monitor and limit failed login attempts
- **Account Lockout**: Automatic account locking after 5 failed attempts
- **Concurrent Login Detection**: Detect logins from multiple locations
- **IP Address Monitoring**: Track rapid IP address changes
- **Suspicious Pattern Detection**: Identify unusual login patterns

### Thresholds

- **Max Failed Attempts**: 5 attempts before lockout
- **Lockout Duration**: 30 minutes
- **Re-Auth Timeout**: 15 minutes
- **Suspicious IP Changes**: 3+ different IPs in 30 minutes

### Implementation

- **Service**: `SecurityService`
- **Monitoring Hook**: `useSessionTracking()`
- **Tables**: `users` (with security columns), `security_events`

## Database Schema

### security_events

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users)
- event_type: VARCHAR(50)
- severity: VARCHAR(20) ['info', 'warning', 'critical']
- description: TEXT
- metadata: JSONB
- ip_address: INET
- user_agent: TEXT
- location: JSONB
- session_id: UUID
- created_at: TIMESTAMPTZ
```

### device_sessions

```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key to users)
- session_id: UUID (Foreign Key to auth.sessions)
- device_name: VARCHAR(255)
- device_type: VARCHAR(50)
- browser: VARCHAR(100)
- browser_version: VARCHAR(50)
- os: VARCHAR(100)
- os_version: VARCHAR(50)
- ip_address: INET
- location: JSONB
- device_fingerprint: VARCHAR(255)
- is_trusted: BOOLEAN
- is_current: BOOLEAN
- last_active: TIMESTAMPTZ
- first_seen: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### users (security columns)

```sql
- last_password_verified_at: TIMESTAMPTZ
- last_sensitive_action_at: TIMESTAMPTZ
- failed_login_attempts: INT
- account_locked_until: TIMESTAMPTZ
- security_settings: JSONB
```

## API Endpoints

### Security Check

`GET /api/security/check-auth`

- Returns whether re-authentication is required

### Verify Authentication

`POST /api/security/verify-auth`

- Updates last password verification timestamp

### Failed Authentication

`POST /api/security/failed-auth`

- Tracks failed login attempts

### Session Tracking

`POST /api/auth/session-tracking`

- Tracks new sessions and device information

## Security Best Practices

1. **Always use ProtectedAction** for sensitive operations
2. **Monitor security events** regularly through the security dashboard
3. **Enable email alerts** for security notifications
4. **Review active sessions** periodically
5. **Implement proper error handling** to avoid exposing sensitive information
6. **Use service role keys** only on the server side
7. **Enable RLS** on all public tables
8. **Set search_path** for all functions

## Configuration

### Environment Variables

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Security Settings

Users can configure their security preferences in `security_settings`:

```json
{
  "two_factor_enabled": false,
  "email_alerts": true
}
```

## Testing

### Test Scenarios

1. **New Device Login**: Login from different browser/device
2. **Failed Login Attempts**: Try wrong password 5+ times
3. **Re-Authentication**: Access billing after 15+ minutes
4. **Session Revocation**: Revoke session from security settings
5. **Concurrent Logins**: Login from multiple locations

### Test Account

- Email: `llm-test@dailynews.com`
- Password: `LLMTest123!@#`

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] Biometric authentication support
- [ ] Hardware security key support
- [ ] Advanced fraud detection with ML
- [ ] Real-time security dashboards
- [ ] Automated threat response
- [ ] IP allowlisting/blocklisting
- [ ] Geofencing restrictions
