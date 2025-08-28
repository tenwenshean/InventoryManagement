# InventoryPro Enterprise

## Overview

InventoryPro is a comprehensive enterprise inventory management system built with React, Express.js, and PostgreSQL. The application provides real-time inventory tracking, product management, accounting integration, QR code generation, and AI-powered chat assistance. It features a modern web interface with shadcn/ui components and implements Replit's authentication system for secure access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints with comprehensive error handling
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Replit's OIDC authentication system with Passport.js
- **Session Management**: Express sessions with PostgreSQL session store

### Data Storage
- **Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection Pooling**: Neon serverless connection pooling for scalability
- **Tables**: Users, products, categories, inventory transactions, accounting entries, chat messages, and sessions

### Authentication & Authorization
- **Provider**: Replit OIDC authentication
- **Session Storage**: PostgreSQL-backed session storage using connect-pg-simple
- **Security**: HTTP-only cookies, CSRF protection, and secure session configuration
- **User Management**: Automatic user creation and profile management from OIDC claims

### Key Features Architecture
- **Inventory Management**: Real-time stock tracking with low-stock alerts and transaction history
- **Product Management**: CRUD operations with category organization and SKU management
- **QR Code Generation**: Dynamic QR code creation for product identification
- **Accounting Integration**: Transaction tracking with accounting entries for inventory movements
- **AI Chatbot**: Chat interface for inventory-related queries and assistance
- **Dashboard Analytics**: Real-time statistics and insights display

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Replit OIDC identity provider
- **Hosting**: Replit deployment platform

### Key Libraries
- **UI Framework**: React 18 with TypeScript
- **Backend Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL adapter
- **UI Components**: Radix UI primitives via shadcn/ui
- **Styling**: Tailwind CSS with PostCSS
- **State Management**: TanStack React Query
- **Form Validation**: Zod schema validation
- **Date Handling**: date-fns utility library

### Development Tools
- **Build Tool**: Vite for frontend bundling
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Backend bundling for production
- **Development**: Hot reload and runtime error overlay via Replit plugins