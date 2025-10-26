import { type DB } from '@op-engineering/op-sqlite'

/**
 * DEVELOPMENT MODE: Single Version Migration
 */
export async function migrateDbIfNeeded(db: DB): Promise<void> {
  const DATABASE_VERSION = 1 // STAYS AT 1 DURING ENTIRE DEVELOPMENT

  const result = await db.execute('PRAGMA user_version')
  let currentDbVersion = (result.rows?.[0]?.user_version as number) ?? 0

  if (currentDbVersion >= DATABASE_VERSION) {
    return // Database already initialized
  }

  if (currentDbVersion === 0) {
    await db.execute('PRAGMA journal_mode = WAL')

    // Create ALL tables for the complete app
    // Add new feature tables here as development progresses
    await db.execute(`
      -- Notes Feature Tables
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        audioUri TEXT,
        recallScript TEXT,
        lastShownInReminisce INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS note_tags (
        noteId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY (noteId, tagId),
        FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        noteId INTEGER NOT NULL,
        uri TEXT NOT NULL,
        description TEXT DEFAULT '',
        FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
      );

      -- Embedding Tables for RAG
      CREATE TABLE IF NOT EXISTS note_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        noteId INTEGER NOT NULL UNIQUE,
        embedding BLOB NOT NULL,
        embeddingDimensions INTEGER NOT NULL,
        textHash TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS image_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        imageId INTEGER NOT NULL UNIQUE,
        description TEXT NOT NULL,
        embedding BLOB NOT NULL,
        embeddingDimensions INTEGER NOT NULL,
        descriptionHash TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (imageId) REFERENCES images(id) ON DELETE CASCADE
      );

      -- Future Feature Tables (Add as development progresses)
      -- Example: Chat Feature (to be added later)
      -- CREATE TABLE IF NOT EXISTS chats (...);
      -- CREATE TABLE IF NOT EXISTS messages (...);

      -- Example: Reminders Feature (to be added later)
      -- CREATE TABLE IF NOT EXISTS reminders (...);

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_notes_createdAt ON notes(createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_note_tags_noteId ON note_tags(noteId);
      CREATE INDEX IF NOT EXISTS idx_images_noteId ON images(noteId);
      CREATE INDEX IF NOT EXISTS idx_note_embeddings_noteId ON note_embeddings(noteId);
      CREATE INDEX IF NOT EXISTS idx_image_embeddings_imageId ON image_embeddings(imageId);
    `)
  }

  await db.execute(`PRAGMA user_version = ${DATABASE_VERSION}`)
}