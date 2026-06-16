# Vercel Environment Variables

## Required Environment Variables

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | https://your-project.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous/public key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key (admin access) | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| ADMIN_EMAIL | Admin email for authentication | admin@example.com |
| ADMIN_PASSWORD | Admin password for authentication | your_secure_password |

## Optional Environment Variables (Google Drive Integration)

| Variable Name | Description | Example Value |
|--------------|-------------|---------------|
| GOOGLE_CLIENT_ID | Google OAuth client ID | 123456789-abcdef.apps.googleusercontent.com |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | GOCSPX-abcdef123456 |
| GOOGLE_REDIRECT_URI | Google OAuth redirect URI | https://marketjonn.vercel.app/api/admin/google-drive/callback |

## How to Add to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with its corresponding value
4. Select the appropriate environments:
   - **Production** - For live deployment
   - **Preview** - For preview deployments
   - **Development** - For development deployments
5. Click **Save** for each variable
6. Redeploy your project to apply the changes

## Important Notes

- Variables starting with `NEXT_PUBLIC_` are exposed to the browser
- `SUPABASE_SERVICE_ROLE_KEY` should never be exposed to the browser (used only in API routes)
- For `GOOGLE_REDIRECT_URI`, replace `your-domain.vercel.app` with your actual Vercel domain
- You can get Supabase credentials from your Supabase project settings:
  - Project Settings → API
- You can get Google OAuth credentials from Google Cloud Console:
  - Create OAuth 2.0 credentials
  - Add the redirect URI to authorized redirect URIs

## Example Values for Testing

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456
GOOGLE_REDIRECT_URI=https://marketjonn.vercel.app/api/admin/google-drive/callback
```
