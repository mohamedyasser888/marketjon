# Jonathon - E-commerce Platform

A modern e-commerce platform built with Next.js, Supabase, and Tailwind CSS. Features include product collections, shopping cart, ticket system, admin dashboard, and real-time messaging.

## Features

- **Product Management**: Browse and purchase products from curated collections
- **Shopping Cart**: Add items to cart, view cart, and manage purchases
- **Ticket System**: Submit and track support tickets
- **Admin Dashboard**: Full admin panel for managing collections, products, tickets, and users
- **Real-time Messaging**: Admin-user messaging with unread message indicators
- **User Profiles**: Profile management with avatar upload
- **Google Drive Integration**: Optional integration for file storage
- **Responsive Design**: Mobile-friendly interface with modern UI

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account and project created
- Google Cloud Console account (optional, for Google Drive integration)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jonathons
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see Environment Variables section below)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

### Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
```

### Optional Variables (Google Drive Integration)

```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://marketjonn.vercel.app/api/admin/google-drive/callback
```

### Getting Supabase Credentials

1. Go to your [Supabase project dashboard](https://supabase.com/dashboard)
2. Navigate to **Project Settings** → **API**
3. Copy the following:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Getting Google OAuth Credentials (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new OAuth 2.0 client ID
3. Add your redirect URI to authorized redirect URIs
4. Copy the Client ID and Client Secret

## Database Setup

Run the database schema setup script:

```bash
# Apply the consolidated schema to your Supabase project
# Use the Supabase SQL editor or CLI to run the schema from supabase/consolidated-schema.sql
```

The schema includes tables for:
- Users and profiles
- Collections and products
- Shopping cart
- Tickets and ticket history
- Messages
- User presence tracking

## Project Structure

```
jonathons/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   ├── collections/       # Collections pages
│   ├── market/            # Market page
│   ├── profile/           # User profile
│   └── tickets/           # Ticket system
├── components/            # React components
│   ├── AdminInboxPanel.tsx
│   ├── UserInboxPanel.tsx
│   ├── UserListSidebar.tsx
│   └── ...
├── lib/                   # Utility functions
│   ├── supabase/          # Supabase client setup
│   └── admin-auth.ts      # Admin authentication
└── supabase/              # Database schema
```

## Admin Dashboard Features

- **Collections**: Manage product collections
- **Products**: Add, edit, and delete products
- **Tickets**: View and manage support tickets
- **Inbox**: Real-time messaging with users
- **Users**: View and manage user accounts
- **History**: View ticket and collection history
- **Google Drive**: Connect Google Drive for file storage

## Deployment

### Vercel Deployment

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import the project in [Vercel](https://vercel.com/new)
3. Add environment variables in Vercel project settings:
   - See `VERCEL_ENV_VARIABLES.md` for complete list
4. Deploy

For detailed environment variable setup, see `VERCEL_ENV_VARIABLES.md`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Supabase Documentation](https://supabase.com/docs) - learn about Supabase
- [Tailwind CSS](https://tailwindcss.com/docs) - learn about Tailwind CSS

## Support

For account recovery, please contact jonathon family.
