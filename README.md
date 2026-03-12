# Brospify Hub

A Discord-inspired chat application built with Next.js 14, Tailwind CSS, shadcn/ui, and Supabase.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Database & Auth**: Supabase
- **Language**: TypeScript

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from Project Settings > API
3. Erstelle `.env.local` mit deinen Supabase-Daten (siehe `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://dein-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **URL & Anon Key**: Supabase Dashboard → Project Settings → API.
- **Service Role Key**: Ebenfalls unter API („service_role“, geheim halten). Wird für Profilabfragen (z. B. Dashboard) benötigt. Ohne ihn werden keine Nutzerdaten geladen.

### 3. Run Database Migration

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and run the contents of `supabase/migrations/001_initial_schema.sql`

This will create:
- `users` table (with role and credits)
- `channels` table (with types: support, winning_product, standard)
- `messages` table
- Row Level Security policies
- Auto-creation of user profiles on signup
- Default channels (General, Support, Winning Products)

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login, register)
│   ├── (main)/           # Main app with sidebar
│   │   └── channels/     # Channel pages
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles (Discord theme)
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── sidebar/          # Sidebar components
│   └── chat/             # Chat components
├── lib/
│   └── supabase/         # Supabase client setup
└── types/
    └── database.ts       # TypeScript types
```

## Features

- Discord-inspired dark UI
- User authentication (sign up, sign in, sign out)
- Channel system with different types
- Real-time messaging (via Supabase Realtime)
- Role-based access (admin/user)
- Posting permissions per channel

## Database Schema

### Users
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (references auth.users) |
| role | TEXT | 'admin' or 'user' |
| license_key | TEXT | Optional unique license |
| credits | INTEGER | User credits (default 0) |

### Channels
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Channel name |
| type | TEXT | 'support', 'winning_product', 'standard' |
| settings | JSONB | Channel settings (posting_enabled, etc.) |

### Messages
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| channel_id | UUID | Reference to channel |
| user_id | UUID | Reference to user |
| content | TEXT | Message content |
| created_at | TIMESTAMP | Creation time |

# brospifyhub
