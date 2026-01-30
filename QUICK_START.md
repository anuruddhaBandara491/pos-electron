# POS Electron - Quick Start Guide

Get the POS Electron desktop application up and running in 5 minutes.

## Installation (2 minutes)

### 1. Prerequisites
- Node.js 16+ ([download](https://nodejs.org/))
- npm 8+ (comes with Node.js)
- POS Laravel backend running at `http://localhost:8000`

### 2. Install Dependencies

```bash
cd c:\xampp\htdocs\pos-electron
npm install
```

This installs:
- Electron (desktop framework)
- React 18 (UI framework)
- Axios (API client)
- Electron-store (persistent storage)
- Electron-log (logging)

## Development (3 minutes)

### Start Development Mode

**Terminal 1 - Electron app:**
```bash
npm run dev
```

**Terminal 2 - React dev server (in separate window):**
```bash
npm start
```

The application will:
- Open at `http://localhost:3000` in Electron
- Connect to backend API
- Show DevTools for debugging
- Hot-reload on code changes

### Test Login

Use credentials from your Laravel database:
- Email: `user@example.com`
- Password: `password`

## Production Build

### Build for Your Platform

```bash
# Windows
npm run dist

# macOS
npm run dist -- --mac

# Linux
npm run dist -- --linux
```

Output installers in `dist/` folder:
- Windows: `pos-system-1.0.0.exe`
- macOS: `pos-system-1.0.0.dmg`
- Linux: `pos-system-1.0.0.AppImage`

## File Structure

```
pos-electron/
├── src/
│   ├── main.js              ← Electron main process
│   ├── preload.js           ← Secure IPC bridge
│   ├── App.js               ← React app
│   ├── pages/               ← Page components
│   ├── components/          ← Reusable components
│   ├── api/ApiManager.js    ← API client
│   ├── ipc/IpcHandler.js    ← IPC handlers
│   └── security/            ← Security utilities
├── public/
│   └── index.html           ← HTML template
├── package.json             ← Dependencies
├── .env                     ← Configuration
└── README.md
```

## Configuration

Edit `.env` to change API URL:

```
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_ENV=development
REACT_APP_DEBUG=true
```

## Available Scripts

```bash
# Development
npm run dev              # Start Electron dev
npm start               # Start React dev server

# Building
npm run build           # Build React + Electron
npm run build:react     # Build React only
npm run dist            # Create installer

# Testing
npm test                # Run tests
npm run lint            # Check code quality

# Utilities
npm run make            # Build without publish
npm run pack            # Test packaging
npm run eject           # Eject create-react-app
```

## Troubleshooting

### App won't start

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm start
```

### Port 3000 already in use

Change dev server port:
```bash
PORT=3001 npm start
```

### API connection refused

1. Check backend is running: `php artisan serve`
2. Check API URL in `.env`
3. Check CORS is enabled in Laravel config

### Build errors

```bash
# Clear build directory
rm -rf build dist
npm run build
```

## Using the App

### Secure IPC API

Access backend from React code:

```javascript
// Login
const response = await window.pos.auth.login(email, password);

// Get products
const products = await window.pos.products.getAll({ page: 1 });

// Process order
const order = await window.pos.orders.create(orderData);

// Get reports
const sales = await window.pos.reports.sales({ startDate, endDate });
```

All API calls:
- ✅ Go through secure preload script
- ✅ Can't access Node.js APIs
- ✅ Use IPC for communication
- ✅ Are authenticated with token

### Security Features

- **Context Isolation** - Renderer can't access Node APIs
- **No Node Integration** - No direct Node access
- **Preload Script** - Whitelisted IPC channels
- **Sandbox Mode** - Limited OS access
- **HTTPS Only** - Production encrypted
- **Rate Limiting** - Prevent brute force
- **Audit Logging** - Track all actions

## Next Steps

1. **Customize UI** - Edit React components in `src/pages/`
2. **Add Features** - Create new pages and API calls
3. **Style App** - Modify CSS in `src/styles/`
4. **Build Installer** - Run `npm run dist`
5. **Deploy** - See BUILD_AND_DEPLOYMENT.md

## Documentation

- [README.md](./README.md) - Complete documentation
- [SECURITY_CONFIG.md](./SECURITY_CONFIG.md) - Security details
- [BUILD_AND_DEPLOYMENT.md](./BUILD_AND_DEPLOYMENT.md) - Deployment guide
- [ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md) - Configuration reference

## Need Help?

### Common Issues

**DevTools doesn't open**
```javascript
// Edit src/main.js, uncomment:
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

**Token expires**
Tokens valid 30 days, auto-refresh 5 minutes before expiry.

**Offline mode**
App stores data in `~/.config/pos-system/` for offline support.

## Project Layout

```
c:\xampp\htdocs\
├── pos-system/          ← Laravel backend
│   └── routes/api_v1.php
└── pos-electron/        ← Electron app (this project)
    ├── src/
    ├── public/
    └── package.json
```

## Development Workflow

```bash
# 1. Start both servers
npm run dev                    # Terminal 1: Electron
npm start                      # Terminal 2: React

# 2. Edit code
# src/pages/DashboardPage.js   # Changes auto-reload
# src/api/ApiManager.js        # Requires app restart

# 3. Test in DevTools
# Press Ctrl+Shift+I to open DevTools
# Console tab for logs
# Network tab for API requests

# 4. Build for production
npm run build
npm run dist

# 5. Test installer
# Run dist/pos-system-1.0.0.exe
```

## Project Details

- **Version**: 1.0.0
- **License**: MIT
- **Framework**: Electron + React
- **Node**: 16+ required
- **Platform**: Windows, macOS, Linux

## Production Checklist

Before releasing:

- [ ] Test all features
- [ ] Update version number
- [ ] Build for all platforms
- [ ] Test installers
- [ ] Sign executables
- [ ] Update changelog
- [ ] Document breaking changes
- [ ] Create release notes
- [ ] Deploy to update server
- [ ] Notify users

---

**Ready to build?** Start with `npm install` and `npm start`! 🚀
