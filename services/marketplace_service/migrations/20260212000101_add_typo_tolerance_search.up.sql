-- 1. Pastikan ekstensi aktif
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Index untuk Title dan Summary (Tetap pakai gin_trgm_ops karena tipe datanya TEXT)
CREATE INDEX IF NOT EXISTS idx_content_title_trgm ON content_items USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_summary_trgm ON content_items USING GIN(summary gin_trgm_ops);

-- 3. FINAL FIX UNTUK TAGS:
-- Kita hapus "gin_trgm_ops" karena kolom tags adalah ARRAY (text[])
CREATE INDEX IF NOT EXISTS idx_content_tags_gin ON content_items USING GIN(tags);