/* This module handles the automatic generation/storage of embeddings for notes/images. Embeddings are computed in the background when notes are created or updated.*/

import { getDatabaseInstance } from '../database'
import { getNoteById } from '../database/notesOperations'
import ModelManager from '../model/ModelManager'
import { type NoteWithDetails, type Tag, type Image } from '../database/types'
import * as Crypto from 'expo-crypto'

const EMBEDDING_CONFIG = {
  EMBEDDING_DIMENSIONS: 768,
  IMAGE_DESCRIPTION_MAX_TOKENS: 300,
  IMAGE_DESCRIPTION_TEMPERATURE: 0.1,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
}

const IMAGE_DESCRIPTION_SYSTEM_PROMPT = `You are analyzing an image from a personal memory journal. Provide a detailed, comprehensive description that captures:

1. WHO: All people visible (describe appearance, expressions, approximate age)
2. WHAT: Main activities, actions, or events happening
3. WHERE: Location, setting, environment details
4. WHEN: Time indicators (season, time of day, weather)
5. OBJECTS: Important items, possessions, notable details
6. EMOTIONS: Mood, atmosphere, feelings conveyed

Be specific and descriptive. Use natural language that helps recall memories. Focus on details that would help someone remember this moment.

Example: "A woman in her 30s with long brown hair wearing a blue summer dress, smiling brightly while standing on a sandy beach. Behind her, the ocean waves are gentle under a clear blue sky. She's holding a red beach umbrella. The setting appears to be mid-afternoon in summer, with bright sunlight creating long shadows. The mood is joyful and relaxed."`

/* Hash text using SHA-256 for change detection */
async function hashText(text: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    text
  )
}

/* Convert Float32Array to Uint8Array for SQLite storage */
function embeddingToBlob(embedding: number[]): Uint8Array {
  const float32Array = new Float32Array(embedding)
  return new Uint8Array(float32Array.buffer)
}

/* Combine note text fields into a single string for embedding */
function combineNoteText(title: string, content: string, tags: string[]): string {
  const tagString = tags.length > 0 ? `Tags: ${tags.join(', ')}\n\n` : ''
  return `${tagString}${title}\n\n${content}`
}

/* Check if models are ready before processing */
async function ensureModelsReady(): Promise<boolean> {
  const embeddingReady = ModelManager.isEmbeddingReady()

  if (!embeddingReady) {
    return false
  }

  return true
}

/* Generate and store embedding for note text (title + content + tags) */
async function generateNoteTextEmbedding(noteId: number): Promise<void> {
  const db = getDatabaseInstance()

  try {
    // Get note data
    const note = await getNoteById(noteId)
    if (!note) {
      return
    }

    // Combine text fields
    const tagNames = note.tags.map(tag => tag.name)
    const combinedText = combineNoteText(note.title, note.content, tagNames)

    // Compute hash
    const textHash = await hashText(combinedText)

    // Check if embedding already exists with same hash
    const existing = await db.execute(
      'SELECT id, textHash FROM note_embeddings WHERE noteId = ?',
      [noteId]
    )

    if (existing.rows && existing.rows.length > 0) {
      const existingRow = existing.rows[0] as unknown as { textHash: string }
      const existingHash = existingRow.textHash
      if (existingHash === textHash) {
        return
      }
    }

    // Get embedding context
    const embeddingContext = ModelManager.getEmbeddingContext()
    if (!embeddingContext) {
      throw new Error('Embedding context not available')
    }

    // Generate embedding
    const result = await embeddingContext.embedding(combinedText)

    if (!result.embedding || result.embedding.length === 0) {
      throw new Error('Empty embedding returned')
    }

    // Convert to blob
    const embeddingBlob = embeddingToBlob(result.embedding)
    const now = Date.now()

    // Store in database
    if (existing.rows && existing.rows.length > 0) {
      // Update existing
      await db.execute(
        'UPDATE note_embeddings SET embedding = ?, embeddingDimensions = ?, textHash = ?, status = ?, createdAt = ? WHERE noteId = ?',
        [embeddingBlob, result.embedding.length, textHash, 'completed', now, noteId]
      )
    } else {
      // Insert new
      await db.execute(
        'INSERT INTO note_embeddings (noteId, embedding, embeddingDimensions, textHash, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [noteId, embeddingBlob, result.embedding.length, textHash, 'completed', now]
      )
    }

  } catch (error) {
    // Update status to failed if record exists
    try {
      await db.execute(
        'UPDATE note_embeddings SET status = ? WHERE noteId = ?',
        ['failed', noteId]
      )
    } catch (updateError) {
      // Ignore update error
    }
  }
}

/* Generate embedding for a single image using user-provided description */
async function generateImageEmbedding(imageId: number, userDescription: string): Promise<void> {
  const db = getDatabaseInstance()

  try {
    if (!userDescription || userDescription.trim().length === 0) {
      return
    }

    // Get embedding context
    const embeddingContext = ModelManager.getEmbeddingContext()
    if (!embeddingContext) {
      throw new Error('Embedding context not available')
    }
    const description = userDescription.trim()

    // Compute hash of description
    const descriptionHash = await hashText(description)

    // Check if embedding already exists with same description
    const existing = await db.execute(
      'SELECT id, descriptionHash FROM image_embeddings WHERE imageId = ?',
      [imageId]
    )

    if (existing.rows && existing.rows.length > 0) {
      const existingRow = existing.rows[0] as unknown as { descriptionHash: string }
      const existingHash = existingRow.descriptionHash
      if (existingHash === descriptionHash) {
        return
      }
    }

    // Generate embedding for the user-provided description
    const embeddingResult = await embeddingContext.embedding(description)
    if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
      throw new Error('Empty embedding returned')
    }

    // Convert to blob
    const embeddingBlob = embeddingToBlob(embeddingResult.embedding)
    const now = Date.now()

    // Store both description and embedding
    if (existing.rows && existing.rows.length > 0) {
      await db.execute(
        'UPDATE image_embeddings SET description = ?, embedding = ?, embeddingDimensions = ?, descriptionHash = ?, status = ?, createdAt = ? WHERE imageId = ?',
        [description, embeddingBlob, embeddingResult.embedding.length, descriptionHash, 'completed', now, imageId]
      )
    } else {
      // Insert new
      await db.execute(
        'INSERT INTO image_embeddings (imageId, description, embedding, embeddingDimensions, descriptionHash, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [imageId, description, embeddingBlob, embeddingResult.embedding.length, descriptionHash, 'completed', now]
      )
    }

  } catch (error) {
    try {
      await db.execute(
        'UPDATE image_embeddings SET status = ? WHERE imageId = ?',
        ['failed', imageId]
      )
    } catch (updateError) {
      // Ignore update error
    }
  }
}

// ============================================================================
// MAIN PIPELINE ORCHESTRATOR
// ============================================================================

/* Process all embeddings for a note (text + images) in parallel. This is the main entry point called after note creation */
export async function processNoteEmbeddings(noteId: number): Promise<void> {
  try {
    const modelsReady = await ensureModelsReady()
    if (!modelsReady) {
      return
    }

    // Get note data
    const note = await getNoteById(noteId)
    if (!note) {
      return
    }

    // Run text embedding and all image embeddings in parallel
    const tasks = [
      // Task 1: Generate text embedding
      generateNoteTextEmbedding(noteId),
      // Task 2+: Generate embedding for each image (only if description exists)
      ...note.images.map(image => generateImageEmbedding(image.id, image.description))
    ]

    await Promise.allSettled(tasks)
  } catch (error) {
    // Don't throw - fail silently in background
  }
}

/* Update embeddings for an edited note. Only recomputes if content has changed (detected via hash) */
// Debounced queue for embedding updates to avoid redundant recomputation during rapid edits
const pendingNotes = new Set<number>()
let updateTimer: ReturnType<typeof setTimeout> | null = null

export async function updateNoteEmbeddings(noteId: number): Promise<void> {
  pendingNotes.add(noteId)
  if (updateTimer) {
    return
  }
  updateTimer = setTimeout(async () => {
    const ids = Array.from(pendingNotes)
    pendingNotes.clear()
    updateTimer = null
    try {
      const modelsReady = await ensureModelsReady()
      if (!modelsReady) {
        return
      }
      await Promise.all(
        ids.map(async (id) => {
          const note = await getNoteById(id)
          if (!note) return
          await processNoteEmbeddings(id)
        })
      )
    } catch {
      // Silent fail; background task
    }
  }, 300)
}
