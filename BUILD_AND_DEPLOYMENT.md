# Build and Deployment Guide

Complete guide for building and deploying the POS Electron application.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Development Workflow](#development-workflow)
3. [Building](#building)
4. [Distribution](#distribution)
5. [Code Signing](#code-signing)
6. [Auto-Updates](#auto-updates)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Troubleshooting](#troubleshooting)

## Development Setup

### Prerequisites

- Node.js 16+ (LTS recommended)
- npm 8+ or yarn
- Git
- Python 3.7+ (for some dependencies)

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd pos-electron

# Install dependencies
npm install

# Copy environment files
cp .env.development .env
```

### Verify Installation

```bash
# Check versions
node --version
npm --version

# Test Electron can start
npm run dev
```

## Development Workflow

### Start Development Environment

**Terminal 1 - Start Electron app:**
```bash
npm run dev
```

**Terminal 2 - Start React dev server:**
```bash
npm start
```

The app will:
1. Load React from `http://localhost:3000`
2. Connect to backend at `http://localhost:8000/api/v1`
3. Open DevTools automatically
4. Hot reload on code changes

### Code Changes

**React Components**: Changes hot-reload automatically
**Electron Main**: Requires app restart
**Preload Script**: Requires app restart
**CSS Styles**: Hot-reload automatically

### Testing

```bash
# Run unit tests
npm test

# Run linting
npm run lint

# Build check
npm run build
```

## Building

### Development Build

```bash
# Build for development
npm run build:react
npm run build:electron
```

Creates `/build` directory with compiled app.

### Production Build

```bash
# Full production build
npm run build

# Or just package (no build)
npm run pack
```

### Build Output

- **Windows**: `dist/pos-system-1.0.0.exe` (NSIS installer)
- **Windows**: `dist/pos-system-1.0.0.exe` (portable)
- **macOS**: `dist/pos-system-1.0.0.dmg`
- **Linux**: `dist/pos-system-1.0.0.AppImage`

## Distribution

### Windows Deployment

#### NSIS Installer

**Build**:
```bash
npm run dist -- --win nsis
```

**Features**:
- Uninstaller included
- Start menu shortcuts
- Desktop shortcut
- Can choose installation path
- File associations

**Distribution**:
```bash
# Sign installer
signtool sign /f cert.pfx /p password /t http://timestamp.server /d "POS System" "dist/pos-system-1.0.0.exe"

# Upload to release server
```

#### Portable Executable

**Build**:
```bash
npm run dist -- --win portable
```

**Features**:
- Single executable file
- No installation required
- Portable USB support
- Settings stored in app directory

**Distribution**:
```bash
# Just copy the exe file
cp dist/pos-system-1.0.0.exe /release/
```

### macOS Deployment

```bash
# Build DMG installer
npm run dist -- --mac dmg

# Sign and notarize
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application" \
  dist/pos-system-1.0.0.dmg

# Notarize for Gatekeeper
xcrun altool --notarize-app \
  --file dist/pos-system-1.0.0.dmg \
  --primary-bundle-id com.pos-system.app
```

### Linux Deployment

#### AppImage

```bash
# Build AppImage
npm run dist -- --linux AppImage

# Make executable
chmod +x dist/pos-system-1.0.0.AppImage

# Distribute
./dist/pos-system-1.0.0.AppImage
```

#### DEB Package

```bash
# Build DEB
npm run dist -- --linux deb

# Install
sudo dpkg -i dist/pos-system-1.0.0.deb
```

## Code Signing

### Windows Code Signing

#### Obtain Certificate

1. Purchase from DigiCert, Sectigo, or GlobalSign
2. Receive `.pfx` file

#### Sign Installer

```bash
# Sign executable
signtool sign /f certificate.pfx \
  /p PASSWORD \
  /t http://timestamp.verisign.com/scripts/timstamp.dll \
  /d "POS System" \
  /du "https://www.possystem.com" \
  "dist/pos-system-1.0.0.exe"
```

#### In package.json

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "password",
      "signingHashAlgorithms": ["sha256"]
    }
  }
}
```

### macOS Code Signing

#### Obtain Certificate

1. Enroll in Apple Developer Program ($99/year)
2. Create certificate in Xcode

#### Sign App

```bash
# Build and sign
npm run dist -- --mac dmg

# Electron builder handles signing automatically
```

#### Notarization

```bash
xcrun altool --notarize-app \
  --file dist/pos-system.dmg \
  --primary-bundle-id com.pos-system.app \
  -u "apple@example.com" \
  -p "app-specific-password"
```

### Linux GPG Signing

```bash
# Sign DEB package
gpg --detach-sign --armor dist/pos-system-1.0.0.deb

# Verify signature
gpg --verify dist/pos-system-1.0.0.deb.asc dist/pos-system-1.0.0.deb
```

## Auto-Updates

### Setup Update Server

1. Configure S3 bucket or update server
2. Store releases with version metadata
3. Configure auto-updater in main process

### Configuration

```javascript
// In main.js
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

### Update Flow

```
1. App checks for updates on startup
2. Download new version in background
3. Notify user when ready to install
4. Install on next restart
5. Show changelog
```

### Release Notes

Create `releases.json`:
```json
{
  "version": "1.1.0",
  "releaseDate": "2024-01-28",
  "changes": [
    "Fixed login issue",
    "Improved performance",
    "Updated UI"
  ]
}
```

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Dist
        run: npm run dist

      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: ${{ matrix.os }}-dist
          path: dist/
```

### GitLab CI Example

Create `.gitlab-ci.yml`:

```yaml
stages:
  - install
  - test
  - build
  - package

install:
  stage: install
  script:
    - npm ci

test:
  stage: test
  script:
    - npm run lint
    - npm test

build_react:
  stage: build
  script:
    - npm run build:react

package_electron:
  stage: package
  script:
    - npm run dist
  artifacts:
    paths:
      - dist/
```

## Troubleshooting

### Build Issues

#### "Cannot find module 'electron'"

```bash
npm install --save-dev electron
npm install electron-rebuild
npm rebuild
```

#### "ENOENT: no such file or directory"

```bash
# Clear cache and reinstall
rm -rf node_modules
npm cache clean --force
npm install
```

#### "Port 3000 already in use"

```bash
# Kill process using port
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Signing Issues

#### "Certificate not found"

1. Verify certificate file path
2. Check password is correct
3. Ensure certificate is valid (not expired)

#### "Timestamp server not responding"

Use different timestamp server:
- http://timestamp.comodoca.com/authenticode
- http://timestamp.globalsign.com/scripts/timstamp.dll
- http://timestamp.sectigo.com/authenticode

### Update Issues

#### Updates not downloading

1. Check update server URL
2. Verify network connectivity
3. Check version is higher than current
4. Review logs in `~/.config/pos-system/logs`

## Maintenance

### Regular Tasks

- Update dependencies: `npm update`
- Check for security vulnerabilities: `npm audit`
- Review and merge pull requests
- Monitor error tracking (Sentry)
- Collect user feedback
- Plan feature releases

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG
3. Create git tag: `git tag v1.1.0`
4. Push changes and tags
5. GitHub Actions builds release
6. Upload to release server
7. Announce release

### Rollback Procedure

If critical issue found:

1. Hotfix in code
2. Increment patch version
3. Build and distribute quickly
4. Notify users of critical update
5. Monitor error logs

## Performance Tuning

### Build Size Optimization

```bash
# Analyze bundle size
npm run analyze

# Results show:
# - Module size
# - Dependencies
# - Optimization opportunities
```

### Runtime Performance

- Monitor with DevTools
- Check for memory leaks
- Profile with Lighthouse
- Review network requests
- Optimize re-renders

### Startup Time

- Lazy load routes
- Code splitting
- Minify assets
- Reduce dependencies
- Use native modules where beneficial

## Security in Distribution

- [ ] Code signing enabled
- [ ] HTTPS certificates valid
- [ ] No hardcoded secrets
- [ ] Dependencies audited
- [ ] No debug info in production build
- [ ] Error tracking enabled
- [ ] Update mechanism secure
- [ ] Installer verified

## Next Steps

1. Set up CI/CD pipeline
2. Configure code signing
3. Setup update server
4. Create release process
5. Document deployment procedure
6. Train team on deployment
7. Plan maintenance schedule
