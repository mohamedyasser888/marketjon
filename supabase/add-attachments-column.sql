-- ============================================================================
-- ADD ATTACHMENTS COLUMN TO MESSAGES TABLE
-- Run this in your Supabase SQL Editor
-- ============================================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';
