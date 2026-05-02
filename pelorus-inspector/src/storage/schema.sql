-- Storage schema for CAN Viewer Pro artifacts
-- Stores DBC files, MDF4 recordings, Rhai scripts, and workflow definitions

CREATE TABLE IF NOT EXISTS artifacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('dbc', 'mdf4', 'rhai', 'workflow')),
    size        INTEGER NOT NULL,
    content     BLOB NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),

    -- Names must be unique within each type
    UNIQUE(name, type)
);

-- Index for fast type-based lookups (list by type)
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);

-- Index for name lookups (get by name + type)
CREATE INDEX IF NOT EXISTS idx_artifacts_name ON artifacts(name, type);
