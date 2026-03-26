-- KalzTunz PostgreSQL initialisation
-- Runs once when the postgres container first starts

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- GIN indexes on scalar types

-- Ensure timezone is UTC
SET timezone = 'UTC';
