-- ============================================================
-- WP Chatbot - Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable full-text search extension (usually already enabled)
create extension if not exists pg_trgm;

-- ============================================================
-- Main knowledge base table
-- ============================================================
create table if not exists document_chunks (
  id          uuid        default gen_random_uuid() primary key,
  bot_id      text        not null,                        -- 'draftsight' or 'simutron'
  source      text        not null,                        -- Original filename
  content     text        not null,                        -- The text chunk
  chunk_index integer     not null default 0,              -- Position within document
  created_at  timestamptz default now(),

  -- Full-text search vector (auto-updated)
  search_vector tsvector generated always as (
    to_tsvector('english', content)
  ) stored
);

-- Indexes for fast queries
create index if not exists idx_chunks_bot_id       on document_chunks (bot_id);
create index if not exists idx_chunks_source       on document_chunks (bot_id, source);
create index if not exists idx_chunks_search       on document_chunks using gin (search_vector);
create index if not exists idx_chunks_created_at   on document_chunks (created_at desc);

-- ============================================================
-- Row Level Security
-- The API uses the service_role key which bypasses RLS,
-- so these policies protect direct client access only.
-- ============================================================
alter table document_chunks enable row level security;

-- Allow public read (needed if you ever query from the browser directly)
create policy "Public can read chunks"
  on document_chunks for select
  using (true);

-- Only service role can write (enforced by using service key in API)
create policy "Service role can write"
  on document_chunks for all
  using (auth.role() = 'service_role');
