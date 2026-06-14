# 🐕 Hope's Habit Tracker

A mobile-first app for tracking your dog Hope's walks and accidents with Google OAuth authentication and real-time sync via Supabase.

## Features

✅ **Google OAuth** - Secure authentication  
✅ **Real-time sync** - Updates across all devices instantly  
✅ **Streak tracking** - Monitor accident-free days  
✅ **Trend visualization** - Daily and weekly charts  
✅ **Dark/light mode** - Comfortable viewing anytime  
✅ **Mobile-first** - Optimized for phones  

## Setup Instructions

### 1. Configure Environment Variables

Update `.env.local` with your actual Supabase anon key (currently has placeholder).

Get your anon key from: Supabase Dashboard → Settings → API → `anon` `public` key

### 2. Set Up Supabase Database

The database table is already created! ✅

If you need to recreate it, run `../setup.sql` in your Supabase SQL Editor.

### 3. Enable Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:  
   `https://qrvhezrapxtnojfdgzeu.supabase.co/auth/v1/callback`
4. Configure in Supabase: **Authentication → Providers → Google**
5. Paste Client ID and Client Secret

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel (One-Click)

1. **Push to GitHub**
   ```bash
   cd .. 
   git add .
   git commit -m "Add Hope's Habit Tracker app"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your `hope-daily-log` repository
   - Set **Root Directory** to `hope-app`
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://qrvhezrapxtnojfdgzeu.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - Click **Deploy**!

3. **Update Google OAuth**
   - After deployment, add your Vercel URL to Google OAuth authorized redirect URIs
   - Format: `https://your-app.vercel.app`

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database + Auth + Real-time
- **Recharts** - Data visualization
- **Vercel** - Deployment platform

## Project Structure

```
hope-app/
├── app/
│   ├── page.tsx          # Main application with all components
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/
│   └── supabase.ts       # Supabase client configuration
├── .env.local            # Environment variables (update anon key!)
└── package.json          # Dependencies
```

## How It Works

1. **Authentication**: Users sign in with Google OAuth
2. **Logging**: Tap buttons to log walks or accidents
3. **Storage**: Data saved to Supabase PostgreSQL with RLS policies
4. **Real-time**: Changes sync instantly across all devices
5. **Visualization**: View trends, streaks, and activity heatmaps

## Support

For issues or questions, check the [Next.js docs](https://nextjs.org/docs) or [Supabase docs](https://supabase.com/docs).
