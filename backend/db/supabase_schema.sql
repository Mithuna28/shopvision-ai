-- ====================================================================
-- SHOPVISION AI — Supabase PostgreSQL Database Schema Migration
-- ====================================================================

-- 1. Jobs Table: Tracks video analysis jobs, processing stages, progress, and status
CREATE TABLE IF NOT EXISTS jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    original_filename TEXT,
    saved_filename TEXT,
    video_path TEXT,
    file_size_mb NUMERIC(10, 2),
    status VARCHAR(50) DEFAULT 'uploaded',
    progress INTEGER DEFAULT 0,
    message TEXT,
    success BOOLEAN DEFAULT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for Jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- 2. Videos Table: Stores extracted video metadata, dimensions, fps, duration, and thumbnail
CREATE TABLE IF NOT EXISTS videos (
    video_id VARCHAR(255) PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    width INTEGER,
    height INTEGER,
    fps NUMERIC(6, 2),
    total_frames INTEGER,
    duration NUMERIC(10, 2),
    thumbnail_path TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for Videos table
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- 3. Products Table: Stores detected & catalog-matched shoppable products per job
CREATE TABLE IF NOT EXISTS products (
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    track_id INTEGER,
    title TEXT,
    brand TEXT,
    category TEXT,
    base_price NUMERIC(12, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    visual_similarity_score NUMERIC(5, 2),
    has_catalog_match BOOLEAN DEFAULT FALSE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (job_id, product_id)
);

-- Indexes for Products table
CREATE INDEX IF NOT EXISTS idx_products_job_id ON products(job_id);
CREATE INDEX IF NOT EXISTS idx_products_track_id ON products(job_id, track_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 4. Overlay Tracks Table: Stores time-synchronized bounding boxes, tracking coords, and intervals
CREATE TABLE IF NOT EXISTS overlay_tracks (
    job_id VARCHAR(255) PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    video_width INTEGER,
    video_height INTEGER,
    duration NUMERIC(10, 2),
    fps NUMERIC(6, 2),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for Overlay Tracks table
CREATE INDEX IF NOT EXISTS idx_overlay_tracks_job_id ON overlay_tracks(job_id);

-- Enable Row Level Security (RLS) for Supabase security policies
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_tracks ENABLE ROW LEVEL SECURITY;

-- Allow access for backend application service role and anon requests
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Allow all access to jobs'
    ) THEN
        CREATE POLICY "Allow all access to jobs" ON jobs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Allow all access to videos'
    ) THEN
        CREATE POLICY "Allow all access to videos" ON videos FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Allow all access to products'
    ) THEN
        CREATE POLICY "Allow all access to products" ON products FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'overlay_tracks' AND policyname = 'Allow all access to overlay_tracks'
    ) THEN
        CREATE POLICY "Allow all access to overlay_tracks" ON overlay_tracks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
