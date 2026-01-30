# Electron Security Configuration

This file contains the security configuration for the POS Electron application.

## Overview

The security configuration is implemented in `src/security/securityConfig.js` and provides comprehensive security settings for production-ready deployment.

## Key Security Features

### 1. Content Security Policy (CSP)

Restricts resource loading to prevent XSS attacks:
- Scripts only from same origin (no inline scripts in production)
- Styles from same origin
- Images from self and HTTPS
- No frame loading
- No object/embed elements

### 2. HTTP Security Headers

- **X-Content-Type-Options**: `nosniff` - Prevents MIME-sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **X-XSS-Protection**: `1; mode=block` - Legacy XSS protection
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer info
- **Permissions-Policy**: Disables dangerous features (geolocation, camera, microphone, etc.)

### 3. Preload Script Isolation

The preload script runs in an isolated context:
- **Context Isolation**: Enabled - Renderer process can't access Node APIs
- **Node Integration**: Disabled - No direct Node access from renderer
- **Sandbox**: Enabled - Renderer process has limited OS access
- **Remote Module**: Disabled - Can't require remote modules

### 4. IPC Channel Whitelist

Only explicitly whitelisted IPC channels are available to the renderer process:
- Authentication channels
- Health check channels
- Version channels
- Product, order, payment, report channels
- Storage and dialog channels
- App control channels

### 5. API Security

- **HTTPS Only** (production) - Encrypted communication
- **Certificate Pinning** - Can be configured for specific servers
- **Origin Validation** - Only communicate with allowed origins
- **Request Timeout** - Default 30 seconds
- **Retry Logic** - Max 3 retries for failed requests

### 6. File System Access Control

Restricted file system access:
- **Allowed**: Documents, Desktop, Temp folders
- **Blocked**: AppData, Cache, Logs, Executable directories

### 7. DevTools Control

- Enabled in development (with debugging)
- Disabled in production
- Cannot be enabled from within the application

### 8. Rate Limiting

Prevents brute force and DoS attacks:
- Max 5 login attempts per 15 minutes
- Max 100 API requests per minute

### 9. Token Security

- Token refresh 5 minutes before expiry
- Secure cookie options with HttpOnly, Secure, SameSite flags
- 30-day token expiration

### 10. Logging

- **Development**: Debug level logging (verbose)
- **Production**: Warn level logging (minimal)
- Log rotation (max 10MB per file, max 5 files)

## Usage

The security configuration is automatically loaded and applied by the main process:

```javascript
const securityConfig = require('./src/security/securityConfig');
```

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Verify HTTPS is enabled for API
- [ ] Configure API origins to production URL
- [ ] Disable DevTools
- [ ] Enable certificate pinning
- [ ] Review and update CSP rules
- [ ] Test all IPC channels
- [ ] Enable code signing for installers
- [ ] Configure auto-update mechanism
- [ ] Set up error tracking (Sentry)
- [ ] Enable monitoring and logging

## Security Best Practices

### For Users

1. Always use HTTPS connections
2. Keep Electron app updated
3. Don't share authentication tokens
4. Log out when finished
5. Use strong passwords

### For Developers

1. Never enable Node integration in renderer
2. Always use context isolation
3. Validate all IPC messages
4. Sanitize user input
5. Keep dependencies updated
6. Review security advisories regularly
7. Use code signing for releases
8. Implement OWASP top 10 protections

## Updating Configuration

To update security settings:

1. Edit `src/security/securityConfig.js`
2. Rebuild the application
3. Test thoroughly in development
4. Deploy to staging first
5. Monitor logs for issues
6. Roll out to production

## References

- [Electron Security Documentation](https://www.electronjs.org/docs/tutorial/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)
