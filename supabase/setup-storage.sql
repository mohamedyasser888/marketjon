-- Setup Storage Bucket for Profile Photos
-- Run this in Supabase → SQL Editor

-- Create the profile-photos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true);

-- Set up policies to allow anyone to read (public bucket)
-- And authenticated users to upload/update their own photos

-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own photos
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);
