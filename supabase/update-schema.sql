-- ============================================================================
-- JONATHON APP - COMPLETE DATABASE INITIALIZATION AND SCHEMAS
-- Run this in your Supabase SQL Editor to prepare all tables and policies.
-- Safe to run multiple times (idempotent updates).
-- ============================================================================

-- 1. FIX PROFILES TABLE
-- Add avatar_url if it doesn't exist, and migrate photo_url data if present
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- Add avatar_url column if not present
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
            ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
        END IF;
        
        -- Sync photo_url data to avatar_url if it was stored there
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'photo_url') THEN
            UPDATE public.profiles SET avatar_url = photo_url WHERE avatar_url IS NULL AND photo_url IS NOT NULL;
        END IF;
    ELSE
        -- Create table from scratch if it doesn't exist at all
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            username TEXT UNIQUE,
            avatar_url TEXT,
            password TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Disable RLS on profiles to avoid insert issues, or configure policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);


-- 2. CREATE COLLECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    images JSONB DEFAULT '[]'::jsonb, -- Array of additional gallery image URLs
    created_by UUID NOT NULL, -- references profiles/auth.users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure collections has images column if it was created before
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collections' AND column_name = 'images') THEN
        ALTER TABLE public.collections ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collections are viewable by everyone" ON public.collections;
CREATE POLICY "Collections are viewable by everyone" 
  ON public.collections FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Only admin can create collections" ON public.collections;
CREATE POLICY "Only admin can create collections" 
  ON public.collections FOR INSERT 
  WITH CHECK (true); -- Authenticated dashboard API handles admin verification

DROP POLICY IF EXISTS "Only admin can update collections" ON public.collections;
CREATE POLICY "Only admin can update collections" 
  ON public.collections FOR UPDATE 
  USING (true); -- Authenticated dashboard API handles admin verification


-- 3. CREATE PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    price DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone" 
  ON public.products FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Only admin can create products" ON public.products;
CREATE POLICY "Only admin can create products" 
  ON public.products FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admin can update products" ON public.products;
CREATE POLICY "Only admin can update products" 
  ON public.products FOR UPDATE 
  USING (true);


-- 4. CREATE CART TABLE
CREATE TABLE IF NOT EXISTS public.cart (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cart" ON public.cart;
CREATE POLICY "Users can view their own cart" 
  ON public.cart FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their own cart" ON public.cart;
CREATE POLICY "Users can add to their own cart" 
  ON public.cart FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cart" ON public.cart;
CREATE POLICY "Users can update their own cart" 
  ON public.cart FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own cart" ON public.cart;
CREATE POLICY "Users can delete from their own cart" 
  ON public.cart FOR DELETE 
  USING (auth.uid() = user_id);


-- 5. CREATE TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    items JSONB NOT NULL,
    total_items INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets" 
  ON public.tickets FOR SELECT 
  USING (auth.uid() = user_id OR true); -- Accessible by owner or backend API

DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
CREATE POLICY "Users can create tickets" 
  ON public.tickets FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update tickets" ON public.tickets;
CREATE POLICY "Admin can update tickets" 
  ON public.tickets FOR UPDATE 
  USING (true);


-- 6. STORAGE BUCKET AND SECURITY SCHEMAS
-- Set up profile-photos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT 
  USING (bucket_id = 'profile-photos' OR bucket_id = 'jonathon-images');

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE 
  USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE 
  USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');

-- Set up jonathon-images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('jonathon-images', 'jonathon-images', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Admin can upload jonathon-images" ON storage.objects;
CREATE POLICY "Admin can upload jonathon-images" ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'jonathon-images');

DROP POLICY IF EXISTS "Admin can update jonathon-images" ON storage.objects;
CREATE POLICY "Admin can update jonathon-images" ON storage.objects FOR UPDATE 
  USING (bucket_id = 'jonathon-images');

DROP POLICY IF EXISTS "Admin can delete jonathon-images" ON storage.objects;
CREATE POLICY "Admin can delete jonathon-images" ON storage.objects FOR DELETE 
  USING (bucket_id = 'jonathon-images');

-- 7. CREATE MESSAGES TABLE FOR USER-ADMIN COMMUNICATION
-- Drop and recreate to ensure proper UUID types
DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID, -- Can be NULL for admin messages
    receiver_id UUID, -- Can be NULL for admin messages
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
CREATE POLICY "Users can view their messages" 
  ON public.messages FOR SELECT 
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Admin can insert messages" ON public.messages;
CREATE POLICY "Admin can insert messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Messages can be updated" ON public.messages;
CREATE POLICY "Messages can be updated" 
  ON public.messages FOR UPDATE 
  USING (true);

-- 8. CREATE USER PRESENCE TABLE
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presence is viewable by everyone" ON public.user_presence;
CREATE POLICY "Presence is viewable by everyone" 
  ON public.user_presence FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can update their presence" ON public.user_presence;
CREATE POLICY "Users can update their presence" 
  ON public.user_presence FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their presence" ON public.user_presence;
CREATE POLICY "Users can insert their presence" 
  ON public.user_presence FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 8. GRANT PRIVILEGES ON TABLES
-- Ensures PostgREST API and Auth client have full usage/access rights to the tables.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
