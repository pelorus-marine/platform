//! Storage State
//!
//! SQLite embedded database for artifact management.

use parking_lot::Mutex;
use rusqlite::{Connection, params};
use std::io::Write as IoWrite;
use std::path::PathBuf;

// Re-export types for backward compatibility
pub use super::types::{Artifact, ArtifactMeta, ArtifactType};

// ─────────────────────────────────────────────────────────────────────────────
// Storage State
// ─────────────────────────────────────────────────────────────────────────────

/// Storage state - manages the SQLite connection
pub struct StorageState {
    conn: Mutex<Connection>,
}

impl StorageState {
    /// Initialize storage with the given data directory
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;

        let db_path = data_dir.join("storage.db");
        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        // Initialize schema
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|e| format!("Failed to initialize schema: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// List all artifacts of a given type
    pub fn list(&self, artifact_type: ArtifactType) -> Result<Vec<ArtifactMeta>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, type, size, created_at, updated_at
                 FROM artifacts WHERE type = ? ORDER BY name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([artifact_type.as_str()], |row| {
                Ok(ArtifactMeta {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    artifact_type: row.get(2)?,
                    size: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    /// Get artifact by name and type
    #[allow(dead_code)] // Part of public API, used in tests
    pub fn get(&self, name: &str, artifact_type: ArtifactType) -> Result<Option<Artifact>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, type, size, content, created_at, updated_at
                 FROM artifacts WHERE name = ? AND type = ?",
            )
            .map_err(|e| e.to_string())?;

        let result = stmt.query_row([name, artifact_type.as_str()], |row| {
            Ok(Artifact {
                id: row.get(0)?,
                name: row.get(1)?,
                artifact_type: row.get(2)?,
                size: row.get(3)?,
                content: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        });

        match result {
            Ok(artifact) => Ok(Some(artifact)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Get only the content of an artifact
    pub fn get_content(
        &self,
        name: &str,
        artifact_type: ArtifactType,
    ) -> Result<Option<Vec<u8>>, String> {
        let conn = self.conn.lock();
        let mut stmt = conn
            .prepare("SELECT content FROM artifacts WHERE name = ? AND type = ?")
            .map_err(|e| e.to_string())?;

        let result: Result<Vec<u8>, _> =
            stmt.query_row([name, artifact_type.as_str()], |row| row.get(0));

        match result {
            Ok(content) => Ok(Some(content)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Store a new artifact (or update existing)
    pub fn store(
        &self,
        name: &str,
        artifact_type: ArtifactType,
        content: &[u8],
    ) -> Result<ArtifactMeta, String> {
        let conn = self.conn.lock();
        let now = chrono::Utc::now().to_rfc3339();
        let size = content.len() as i64;

        conn.execute(
            "INSERT INTO artifacts (name, type, size, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT(name, type) DO UPDATE SET
                size = excluded.size,
                content = excluded.content,
                updated_at = excluded.updated_at",
            params![name, artifact_type.as_str(), size, content, now],
        )
        .map_err(|e| e.to_string())?;

        // Get the actual row (could be insert or update)
        let mut stmt = conn
            .prepare(
                "SELECT id, name, type, size, created_at, updated_at
                 FROM artifacts WHERE name = ? AND type = ?",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row([name, artifact_type.as_str()], |row| {
            Ok(ArtifactMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                artifact_type: row.get(2)?,
                size: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    /// Delete an artifact
    pub fn delete(&self, name: &str, artifact_type: ArtifactType) -> Result<bool, String> {
        let conn = self.conn.lock();
        let affected = conn
            .execute(
                "DELETE FROM artifacts WHERE name = ? AND type = ?",
                [name, artifact_type.as_str()],
            )
            .map_err(|e| e.to_string())?;

        Ok(affected > 0)
    }

    /// Check if a name exists for a type
    pub fn exists(&self, name: &str, artifact_type: ArtifactType) -> Result<bool, String> {
        let conn = self.conn.lock();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM artifacts WHERE name = ? AND type = ?",
                [name, artifact_type.as_str()],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        Ok(count > 0)
    }

    /// Rename an artifact
    pub fn rename(
        &self,
        old_name: &str,
        new_name: &str,
        artifact_type: ArtifactType,
    ) -> Result<ArtifactMeta, String> {
        // Check if new name already exists
        if self.exists(new_name, artifact_type)? {
            return Err(format!("Artifact '{}' already exists", new_name));
        }

        let conn = self.conn.lock();
        let now = chrono::Utc::now().to_rfc3339();

        let affected = conn
            .execute(
                "UPDATE artifacts SET name = ?, updated_at = ? WHERE name = ? AND type = ?",
                params![new_name, now, old_name, artifact_type.as_str()],
            )
            .map_err(|e| e.to_string())?;

        if affected == 0 {
            return Err(format!("Artifact '{}' not found", old_name));
        }

        // Return updated metadata
        let mut stmt = conn
            .prepare(
                "SELECT id, name, type, size, created_at, updated_at
                 FROM artifacts WHERE name = ? AND type = ?",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row([new_name, artifact_type.as_str()], |row| {
            Ok(ArtifactMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                artifact_type: row.get(2)?,
                size: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    /// Export all artifacts to a ZIP file
    pub fn export_all(&self, path: &str) -> Result<usize, String> {
        let file =
            std::fs::File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let conn = self.conn.lock();

        // Get all artifacts
        let mut stmt = conn
            .prepare("SELECT name, type, content, created_at, updated_at FROM artifacts ORDER BY type, name")
            .map_err(|e| e.to_string())?;

        let mut count = 0;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;

        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let name: String = row.get(0).map_err(|e| e.to_string())?;
            let atype: String = row.get(1).map_err(|e| e.to_string())?;
            let content: Vec<u8> = row.get(2).map_err(|e| e.to_string())?;
            let created_at: String = row.get(3).map_err(|e| e.to_string())?;
            let updated_at: String = row.get(4).map_err(|e| e.to_string())?;

            // Store as: type/name (e.g., "dbc/my_file.dbc")
            let zip_path = format!("{}/{}", atype, name);

            // Write file content
            zip.start_file(&zip_path, options)
                .map_err(|e| format!("Failed to write to ZIP: {}", e))?;
            zip.write_all(&content)
                .map_err(|e| format!("Failed to write content: {}", e))?;

            // Write metadata as .meta file
            let meta_path = format!("{}.meta", zip_path);
            let meta = format!("created_at={}\nupdated_at={}\n", created_at, updated_at);
            zip.start_file(&meta_path, options)
                .map_err(|e| format!("Failed to write meta: {}", e))?;
            zip.write_all(meta.as_bytes())
                .map_err(|e| format!("Failed to write meta content: {}", e))?;

            count += 1;
        }

        zip.finish()
            .map_err(|e| format!("Failed to finalize ZIP: {}", e))?;

        Ok(count)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn create_test_storage() -> StorageState {
        let id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = temp_dir().join(format!(
            "cvp_test_{}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            id
        ));
        StorageState::new(dir).expect("Failed to create test storage")
    }

    #[test]
    fn test_store_and_get() {
        let storage = create_test_storage();
        let content = b"test content";

        let meta = storage
            .store("test.dbc", ArtifactType::Dbc, content)
            .unwrap();
        assert_eq!(meta.name, "test.dbc");
        assert_eq!(meta.size, content.len() as i64);

        let artifact = storage.get("test.dbc", ArtifactType::Dbc).unwrap().unwrap();
        assert_eq!(artifact.content, content);
    }

    #[test]
    fn test_list() {
        let storage = create_test_storage();

        storage.store("a.dbc", ArtifactType::Dbc, b"a").unwrap();
        storage.store("b.dbc", ArtifactType::Dbc, b"b").unwrap();
        storage.store("c.rhai", ArtifactType::Rhai, b"c").unwrap();

        let dbc_list = storage.list(ArtifactType::Dbc).unwrap();
        assert_eq!(dbc_list.len(), 2);

        let rhai_list = storage.list(ArtifactType::Rhai).unwrap();
        assert_eq!(rhai_list.len(), 1);
    }

    #[test]
    fn test_delete() {
        let storage = create_test_storage();

        storage
            .store("delete_me.dbc", ArtifactType::Dbc, b"test")
            .unwrap();
        assert!(storage.exists("delete_me.dbc", ArtifactType::Dbc).unwrap());

        let deleted = storage.delete("delete_me.dbc", ArtifactType::Dbc).unwrap();
        assert!(deleted);
        assert!(!storage.exists("delete_me.dbc", ArtifactType::Dbc).unwrap());
    }

    #[test]
    fn test_rename() {
        let storage = create_test_storage();

        storage
            .store("old_name.dbc", ArtifactType::Dbc, b"content")
            .unwrap();

        let renamed = storage
            .rename("old_name.dbc", "new_name.dbc", ArtifactType::Dbc)
            .unwrap();
        assert_eq!(renamed.name, "new_name.dbc");

        assert!(!storage.exists("old_name.dbc", ArtifactType::Dbc).unwrap());
        assert!(storage.exists("new_name.dbc", ArtifactType::Dbc).unwrap());
    }

    #[test]
    fn test_unique_per_type() {
        let storage = create_test_storage();

        // Same name, different types should work
        storage
            .store("same_name", ArtifactType::Dbc, b"dbc content")
            .unwrap();
        storage
            .store("same_name", ArtifactType::Rhai, b"rhai content")
            .unwrap();

        let dbc = storage
            .get("same_name", ArtifactType::Dbc)
            .unwrap()
            .unwrap();
        let rhai = storage
            .get("same_name", ArtifactType::Rhai)
            .unwrap()
            .unwrap();

        assert_eq!(dbc.content, b"dbc content");
        assert_eq!(rhai.content, b"rhai content");
    }
}
