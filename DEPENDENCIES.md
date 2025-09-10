# InventoryPro Enterprise - Dependencies Guide

## Overview
This document provides information about the project dependencies and how to manage them.

## Core Dependencies

### Frontend Framework
- **React 18** - UI framework with TypeScript support
- **Vite** - Fast build tool and development server
- **TypeScript** - Type safety and enhanced development experience

### UI Components & Styling
- **Radix UI** - Headless UI primitives for accessibility
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Pre-built components using Radix + Tailwind
- **Lucide React** - Beautiful icon library
- **Recharts** - Responsive chart library for analytics

### State Management & Data Fetching
- **TanStack React Query** - Server state management
- **React Hook Form** - Performant form handling
- **Zod** - Schema validation

### Routing & Navigation
- **Wouter** - Lightweight client-side routing

### Backend Framework
- **Express.js** - Web application framework for Node.js
- **TypeScript** - Type safety for server-side code
- **tsx** - TypeScript execution for Node.js

### Database & ORM
- **Drizzle ORM** - Type-safe database operations
- **Drizzle Kit** - Database migrations and schema management
- **Neon Serverless** - PostgreSQL serverless database
- **pg** - PostgreSQL client for Node.js

### Authentication & Security
- **Passport.js** - Authentication middleware
- **OpenID Client** - OAuth/OIDC authentication
- **Express Session** - Session management
- **MemoryStore** - In-memory session storage (development)

## Installation Instructions

### Quick Start
```bash
# All dependencies are managed through npm
npm install

# Start development server
npm run dev
```

### Environment Variables
Create these environment variables for proper functionality:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret key for session management
- `REPLIT_DOMAINS` - Domains for authentication
- `REPL_ID` - Replit application ID

### Database Setup
```bash
# Push schema to database
npm run db:push

# Generate database migrations (if needed)
npm run db:generate
```

## Development Tools

### Code Quality
- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Build & Deployment
- **Vite** - Frontend bundling and optimization
- **esbuild** - Fast JavaScript bundler
- **PostCSS** - CSS processing

## Package Management

All dependencies are automatically managed through the `package.json` file. The project uses:

- **npm** as the package manager
- **Replit's package management system** for automatic dependency resolution
- **Node.js v18+** as the runtime environment

## Adding New Dependencies

To add new dependencies to the project:

1. **Frontend packages**: Use the package manager tool or npm install
2. **Backend packages**: Add to package.json and run npm install
3. **Type definitions**: Include @types/* packages for TypeScript support

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database operations
npm run db:push        # Push schema changes
npm run db:generate    # Generate migrations
npm run db:studio     # Open database studio

# Type checking
npm run type-check
```

## Troubleshooting

### Common Issues
1. **Port conflicts**: The development server runs on port 5000
2. **Database connection**: Ensure DATABASE_URL is properly configured
3. **Authentication**: Verify Replit authentication environment variables
4. **Build issues**: Clear node_modules and reinstall if needed

### Solutions
- Restart the workflow if changes aren't reflected
- Check environment variables are properly set
- Ensure all required secrets are configured
- Verify database connection and schema

## Project Structure

```
├── client/             # Frontend React application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   └── lib/        # Utility functions
├── server/             # Backend Express application
│   ├── routes.ts       # API route definitions
│   ├── storage.ts      # Data storage layer
│   └── replitAuth.ts   # Authentication setup
├── shared/             # Shared TypeScript types
│   └── schema.ts       # Database schema and types
└── package.json        # Dependency definitions
```

## Notes

- This project is optimized for the Replit platform
- Dependencies are automatically managed by the platform
- No additional system dependencies are required
- The project uses modern web standards and best practices