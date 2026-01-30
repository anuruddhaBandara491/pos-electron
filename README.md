# POS System - Electron Desktop Application

A production-ready Point of Sale (POS) desktop application built with Electron and React, designed to work seamlessly with the Laravel POS backend.

## Features

### Security-First Architecture

- ✅ **Context Isolation** - Renderer process isolated from Node.js APIs
- ✅ **Disabled Node Integration** - No direct Node access from frontend
- ✅ **Preload Script** - Secure IPC bridge with whitelisted channels
- ✅ **Sandbox Mode** - Renderer process runs in restricted environment
- ✅ **Content Security Policy** - XSS and injection attack prevention
- ✅ **HTTPS Only** (Production) - Encrypted API communication

### Core Features

- **Authentication** - Secure user login with token-based auth
- **Dashboard** - Real-time sales and order metrics
- **Products** - Complete product management
- **Orders** - Point-of-sale order processing
- **Payments** - Multi-payment method support
- **Reports** - Sales, inventory, and financial reports
- **Offline Support** - Local storage for offline operations
- **Auto-Update** - Built-in update checking and installation

### Developer Experience

- React 18 with modern hooks
- React Router for navigation
- Axios for API calls
- Electron-log for logging
- Electron-store for secure storage
- CORS and HTTPS support
- Environment-based configuration
- Development and production builds

## Prerequisites

- Node.js 16+ and npm
- Electron 27+
- React 18+
- Running POS Laravel backend (http://localhost:8000/api/v1)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd pos-electron

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update API URL in .env if needed
```

## Development

### Start Development Server

```bash
# Start Electron in development mode with React dev server
npm run dev

# In another terminal, start React dev server
npm start
```

The app will:
1. Load React dev server at http://localhost:3000
2. Connect to backend API at http://localhost:8000/api/v1
3. Open DevTools for debugging
4. Hot reload on code changes

### Development Environment Variables

`.env.development`:
```
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_ENV=development
REACT_APP_DEBUG=true
```

## Building

### Build for Current Platform

```bash
# Build React and create executable
npm run build

# Or create installer
npm run dist
```

### Build Configuration

The build process:
1. Builds React app to `/build` directory
2. Packages with Electron builder
3. Creates platform-specific installers:
   - **Windows**: NSIS installer + portable exe
   - **macOS**: DMG + ZIP
   - **Linux**: AppImage + DEB

## Project Structure

```
pos-electron/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC preload script (secure bridge)
│   ├── App.js               # React root component
│   ├── index.js             # React entry point
│   │
│   ├── pages/               # React page components
│   │   ├── LoginPage.js
│   │   ├── DashboardPage.js
│   │   ├── ProductsPage.js
│   │   ├── OrdersPage.js
│   │   ├── ReportsPage.js
│   │   └── SettingsPage.js
│   │
│   ├── components/          # React components
│   │   └── Navigation.js
│   │
│   ├── context/             # React context
│   │   └── AuthContext.js
│   │
│   ├── api/                 # API communication
│   │   └── ApiManager.js
│   │
│   ├── ipc/                 # IPC handlers
│   │   └── IpcHandler.js
│   │
│   ├── security/            # Security utilities
│   │   ├── SecurityManager.js
│   │   └── securityConfig.js
│   │
│   ├── styles/              # Component styles
│   │   ├── LoginPage.css
│   │   ├── DashboardPage.css
│   │   ├── Navigation.css
│   │   └── [other pages].css
│   │
│   ├── index.css            # Global styles
│   └── App.css
│
├── public/
│   ├── index.html           # HTML entry point
│   └── icon.png             # App icon
│
├── package.json             # Dependencies and build config
├── .env                     # Environment variables
├── .env.development         # Dev config
├── .env.production          # Production config
├── .gitignore
├── README.md
├── SECURITY_CONFIG.md       # Security documentation
└── ENV_CONFIGURATION.md     # Environment configuration
```

## IPC API Reference

The preload script exposes a secure `window.pos` API for renderer process:

### Authentication

```javascript
// Login
await window.pos.auth.login(email, password);

// Logout
await window.pos.auth.logout();

// Get current user
const user = await window.pos.auth.getCurrentUser();

// Refresh token
await window.pos.auth.refreshToken();
```

### Health Checks

```javascript
// Basic health check
const health = await window.pos.health.check();

// Detailed metrics
const metrics = await window.pos.health.getDetailed();

// Liveness probe
const alive = await window.pos.health.getLive();

// Readiness probe
const ready = await window.pos.health.getReady();
```

### Version Management

```javascript
// Get current version
const version = await window.pos.version.getCurrent();

// Get detailed version info
const detailed = await window.pos.version.getDetailed();

// Check compatibility
const compat = await window.pos.version.checkCompatibility('1.0.0');

// Get changelog
const changelog = await window.pos.version.getChangelog(10);
```

### Products

```javascript
// Get all products
const products = await window.pos.products.getAll({ page: 1, limit: 20 });

// Get single product
const product = await window.pos.products.getById(id);

// Create product
const created = await window.pos.products.create(productData);

// Update product
const updated = await window.pos.products.update(id, updateData);

// Delete product
await window.pos.products.delete(id);
```

### Orders

```javascript
// Get orders
const orders = await window.pos.orders.getAll({ status: 'pending' });

// Create order
const order = await window.pos.orders.create(orderData);

// Checkout
const receipt = await window.pos.orders.checkout(checkoutData);

// Cancel order
await window.pos.orders.cancel(orderId);
```

### Payments

```javascript
// Process payment
const payment = await window.pos.payments.process(paymentData);

// Get history
const history = await window.pos.payments.getHistory();

// Refund
await window.pos.payments.refund(paymentId);
```

### Reports

```javascript
// Sales report
const sales = await window.pos.reports.sales({ startDate, endDate });

// Inventory report
const inventory = await window.pos.reports.inventory();

// Top products
const topProducts = await window.pos.reports.topProducts({ limit: 10 });

// Cash flow
const cashFlow = await window.pos.reports.cashFlow({ month: '2024-01' });
```

### Storage

```javascript
// Get value
const value = await window.pos.storage.get('key');

// Set value
await window.pos.storage.set('key', value);

// Remove
await window.pos.storage.remove('key');

// Clear all
await window.pos.storage.clear();
```

### Dialogs

```javascript
// Show error
await window.pos.dialog.showError('Error Title', 'Error message');

// Show info
await window.pos.dialog.showInfo('Info Title', 'Info message');

// Show question
const result = await window.pos.dialog.showQuestion('Question', 'Confirm?');
```

### App Control

```javascript
// Get app version
const version = await window.pos.app.getVersion();

// Get app path
const path = await window.pos.app.getPath('userData');

// Minimize window
await window.pos.app.minimize();

// Maximize window
await window.pos.app.maximize();

// Close window
await window.pos.app.close();
```

## Security Best Practices

### For Users

1. Always use HTTPS in production
2. Keep the application updated
3. Never share authentication tokens
4. Use strong passwords
5. Log out when finished

### For Developers

1. **Never disable context isolation** - Critical for security
2. **Never enable Node integration** - Allows arbitrary code execution
3. **Always validate IPC messages** - Prevent code injection
4. **Keep dependencies updated** - Security patches
5. **Use code signing** - Verify app authenticity
6. **Monitor error logs** - Detect suspicious activity
7. **Review security advisories** - Stay informed

## Production Deployment

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Update API URL to production server
- [ ] Enable HTTPS certificate pinning
- [ ] Disable DevTools
- [ ] Enable code signing
- [ ] Setup auto-update mechanism
- [ ] Configure error tracking (Sentry)
- [ ] Test all functionality
- [ ] Security audit completed
- [ ] Update installer branding

### Build for Production

```bash
# Build signed installer for Windows
npm run dist -- --publish=never

# Build for all platforms
npm run dist -- --win --mac --linux
```

### Environment Variables

`.env.production`:
```
REACT_APP_API_URL=https://api.possystem.com/api/v1
REACT_APP_ENV=production
REACT_APP_DEBUG=false
```

## Performance Optimization

### Code Splitting

React Router lazy loads pages:
```javascript
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
```

### Caching

- API responses cached with axios
- Electron store for persistent data
- Service workers for offline support (optional)

### Bundle Size

- Tree shaking enabled
- Minified production builds
- Code splitting by route

## Troubleshooting

### App won't start

1. Check Node.js version (16+)
2. Delete `node_modules` and reinstall: `npm install`
3. Clear cache: `npm cache clean --force`
4. Check for port conflicts (3000, 8000)

### API connection issues

1. Verify backend is running: `php artisan serve`
2. Check API URL in `.env`
3. Verify CORS configuration in backend
4. Check network connectivity
5. Review logs in Developer Tools

### Build errors

1. Clear build artifacts: `rm -rf build dist`
2. Reinstall dependencies: `npm install`
3. Check Node.js version compatibility
4. Review Electron builder config

### Performance issues

1. Check for memory leaks in DevTools
2. Monitor API response times
3. Review bundle size: `npm run analyze`
4. Disable DevTools in production

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and support:
- GitHub Issues: https://github.com/pos-system/issues
- Documentation: See docs/ folder
- Email: support@possystem.com

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Security Best Practices](./SECURITY_CONFIG.md)
- [Environment Configuration](./ENV_CONFIGURATION.md)
- [API Reference](../pos-system/ELECTRON_INTEGRATION.md)

---

Built with ❤️ for efficient point-of-sale operations
