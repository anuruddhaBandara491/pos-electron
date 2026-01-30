# Environment Variables and Configuration

This file documents all environment variables used in the POS Electron application.

## Development Configuration (.env.development)

```
REACT_APP_API_URL=http://localhost:8000/api/v1
REACT_APP_ENV=development
REACT_APP_DEBUG=true
REACT_APP_API_TIMEOUT=30000
```

## Production Configuration (.env.production)

```
REACT_APP_API_URL=https://api.possystem.com/api/v1
REACT_APP_ENV=production
REACT_APP_DEBUG=false
REACT_APP_API_TIMEOUT=30000
```

## Variables

- **REACT_APP_API_URL**: Backend API URL (changes per environment)
- **REACT_APP_ENV**: Application environment (development/production)
- **REACT_APP_DEBUG**: Enable debug logging and DevTools
- **REACT_APP_API_TIMEOUT**: API request timeout in milliseconds
- **REACT_APP_APP_NAME**: Application display name
- **REACT_APP_APP_VERSION**: Application version

## Usage

The `.env` file is loaded automatically by React and Electron.

Access variables in React components:
```javascript
const apiUrl = process.env.REACT_APP_API_URL;
```

Access variables in Electron main process:
```javascript
const apiUrl = process.env.REACT_APP_API_URL;
```
