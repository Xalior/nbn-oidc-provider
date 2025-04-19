# NBN OIDC Provider

An OpenID Connect (OIDC) Provider implementation that allows you to authenticate users and issue tokens for authorized applications.

## Project Overview

This project consists of two main components:

1. **OIDC Provider**: A standards-compliant OpenID Connect identity provider that handles authentication and authorization flows.

2. **Admin Client**: Functions as an OIDC credential controller for account administration, user management, and application registration.

The dual architecture allows for a complete identity management solution where the provider handles the core OIDC protocols while the client provides user-friendly interfaces for managing credentials, accounts, and application access.

## Package Manager: pnpm

This project uses [pnpm](https://pnpm.io/) as its package manager. Please do not use npm or yarn to install dependencies or run scripts.

### Why pnpm?

- Faster installation times
- More efficient disk space usage
- Better dependency management
- Strict mode to prevent phantom dependencies

### Installation

First, install pnpm if you don't have it already:

```bash
npm install -g pnpm
```

Then, install dependencies:

```bash
pnpm install
```

### Running Scripts

Use pnpm to run scripts defined in package.json:

```bash
pnpm start           # Start the server
pnpm build           # Build the project
pnpm run db:generate # Generate database migrations
pnpm run db:push     # Push database schema changes
pnpm run nodemon     # Run with nodemon for development
```

### Note

The project is configured to enforce the use of pnpm. If you try to use npm, the installation will fail with an error message.

## Setup Instructions

### 1. Generate JWKS (JSON Web Key Set)

Before running the application, you need to generate the cryptographic keys used for signing tokens:

```bash
node generateJwks.js
```

This script will:
- Create a `keys` directory if it doesn't exist
- Generate RSA and EC private keys using OpenSSL
- Convert these keys to JWK format
- Create both private and public JWKS files
- Set secure permissions for the generated files

Options:
- `-f`: Force overwrite existing keys
- `--no-public`: Skip public JWKS generation

Example:
```bash
node generateJwks.js -f  # Force overwrite existing keys
```

**Important**: Keep your private keys secure! Do not share them or include them in your application code.

### 2. Configure the Application

Copy the example configuration file and modify it according to your needs:

```bash
cp data/config.js.example data/config.js
```

Edit the `data/config.js` file to configure:
- Database connections
- OIDC provider settings
- Email settings
- Security settings

### 3. Start the Application

```bash
pnpm start
```

For development with auto-reload:
```bash
pnpm run nodemon
```

## Project Structure

### Data Directory

The `data` directory contains configuration and data files:

- `config.js`: Main configuration file
- `config.js.example`: Example configuration template
- `clients.csv`: OIDC client configurations
- `testdata.js`: Test data for development
- `testdata.js.example`: Example test data template

This directory is mounted as a volume when running in Docker to persist configuration and data.

## Production Deployment

### Environment Variables

For production deployment, you should configure the following environment variables:

```bash
# General configuration
NODE_ENV=production                  # Set to 'production' for production environment
SLUG=id.nextbestnetwork.com          # Domain for the OIDC provider
SESSION_SECRET=your_secure_secret    # Secret for session encryption
COOKIE_KEYS=key1,key2,key3           # Comma-separated list of cookie encryption keys

# Database and cache configuration
DATABASE_URL=mysql://user:pass@host:port/database
CACHE_URL=redis://host:port/

# SMTP configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false                    # Set to 'true' for SSL/TLS
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password

# Client configuration
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret

# Patreon integration (if used)
PATREON_CLIENT_ID=your_patreon_client_id
PATREON_CLIENT_SECRET=your_patreon_client_secret
```

### Production Checklist

Before deploying to production, ensure you have:

1. Generated secure JWKS keys using `node generateJwks.js`
2. Set all required environment variables with secure values
3. Configured proper database and cache connections
4. Set up proper SMTP settings for email delivery
5. Disabled any debugging features
6. Ensured HTTPS is properly configured

## Docker Support

This project includes Docker support for easy deployment and containerization.

### Database Initialization

The Docker container automatically initializes the database on startup by:
1. Generating database migrations if they don't exist
2. Pushing schema changes to the database (creating tables if they don't exist and updating them if they do)
3. Running any pending migrations that haven't been applied yet

This ensures that your database schema is always up-to-date when the container starts, making the database "automatically upgrading" without errors even if tables already exist. The system gracefully handles both fresh installations and updates to existing databases.

### Quick Start with Docker

```bash
# Build and run with Docker Compose
docker-compose up

# Or build and run manually with environment variables
docker build -t nbn-oidc-provider .
docker run -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your_secure_secret \
  -e DATABASE_URL=mysql://user:pass@host:port/database \
  -e CACHE_URL=redis://host:port/ \
  nbn-oidc-provider
```

For detailed Docker instructions, including deployment options and configuration, see [README.docker.md](README.docker.md).

## Development

### Building Frontend Assets

```bash
pnpm build
```

### Database Management

```bash
# Generate database migrations
pnpm run db:generate

# Push schema changes to the database
pnpm run db:push

# Reset the database (remove and recreate)
pnpm run db:remake
```

### Running Tests

```bash
pnpm run wdio
```

## Features

### Authentication Features

- **Multi-Factor Authentication**: Email-based PIN verification for secure login
- **Remember Me**: Option to stay logged in for extended periods (30 days)
- **Password Reset**: Self-service password recovery flow
- **Account Confirmation**: Email verification for new accounts

