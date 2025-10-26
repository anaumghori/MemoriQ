import { getDatabaseInstance } from '../database'
import { getNoteById } from '../database/notesOperations'

const RETRIEVAL_CONFIG = {
  TOP_K: 2,                      // Max notes to retrieve
  MIN_K: 1,                      // Min notes to retrieve if any match
  SIMILARITY_THRESHOLD: 0.5,     // Minimum cosine similarity score (raised from 0.3)
  RELATIVE_THRESHOLD: 0.75,      // Secondary notes must be within 75% of top score
  TIMEOUT_MS: 5000               // Max time for retrieval
}

export interface RetrievedNote {
  noteId: number
  title: string
  content: string
  tags: string[]
  images: Array<{ uri: string; description: string }>
  audioUri?: string
  similarityScore: number
  matchType: 'text' | 'image'
}

/* Calculate cosine similarity between two vectors */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  return similarity
}

/* Convert Uint8Array blob back to Float32Array */
function blobToEmbedding(blob: unknown): Float32Array {
  if (blob instanceof Uint8Array) {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
  }
  if (blob instanceof ArrayBuffer) {
    return new Float32Array(blob)
  }
  if (
    typeof blob === 'object' &&
    blob !== null &&
    'buffer' in blob &&
    'byteOffset' in blob &&
    'byteLength' in blob
  ) {
    const b = blob as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }
    return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)
  }
  throw new Error('Unsupported blob type')
}

/**
 * @param queryEmbedding - The query embedding vector
 * @param topK - Maximum number of notes to retrieve (default: 3)
 * @returns Array of retrieved notes with similarity scores
 */
export async function retrieveRelevantNotes(
  queryEmbedding: Float32Array,
  topK: number = RETRIEVAL_CONFIG.TOP_K
): Promise<RetrievedNote[]> {
  try {
    const db = getDatabaseInstance()

    // Map to store best match per note (noteId -> {score, matchType})
    const noteMatches = new Map<number, { score: number; matchType: 'text' | 'image' }>()

    // 1 & 2. Search note text embeddings AND image embeddings in parallel
    const [noteEmbeddingsResult, imageEmbeddingsResult] = await Promise.all([
      db.execute('SELECT noteId, embedding FROM note_embeddings WHERE status = \'completed\''),
      db.execute(
        `SELECT ie.imageId, ie.embedding, ie.description, i.noteId, i.uri
         FROM image_embeddings ie
         JOIN images i ON ie.imageId = i.id
         WHERE ie.status = 'completed'`
      )
    ])

    // Process note text embeddings
    if (noteEmbeddingsResult.rows) {
      for (const row of noteEmbeddingsResult.rows as Array<{ noteId: number; embedding: unknown }>) {
        const noteId = row.noteId
        const embeddingBlob = row.embedding

        try {
          const noteEmbedding = blobToEmbedding(embeddingBlob)
          const similarity = cosineSimilarity(queryEmbedding, noteEmbedding)

          // Only consider if above threshold
          if (similarity >= RETRIEVAL_CONFIG.SIMILARITY_THRESHOLD) {
            const existing = noteMatches.get(noteId)
            if (!existing || similarity > existing.score) {
              noteMatches.set(noteId, { score: similarity, matchType: 'text' })
            }
          }
        } catch (error) {
          // Skip this note
        }
      }
    }

    // Process image embeddings
    if (imageEmbeddingsResult.rows) {
      for (const row of imageEmbeddingsResult.rows as Array<{ noteId: number; embedding: unknown }>) {
        const noteId = row.noteId
        const embeddingBlob = row.embedding

        try {
          const imageEmbedding = blobToEmbedding(embeddingBlob)
          const similarity = cosineSimilarity(queryEmbedding, imageEmbedding)
          if (similarity >= RETRIEVAL_CONFIG.SIMILARITY_THRESHOLD) {
            const existing = noteMatches.get(noteId)
            if (!existing || similarity > existing.score) {
              noteMatches.set(noteId, { score: similarity, matchType: 'image' })
            }
          }
        } catch (error) {
          // Skip this image
        }
      }
    }

    // 3. Sort by similarity and apply relative threshold
    const sortedMatches = Array.from(noteMatches.entries())
      .sort(([, a], [, b]) => b.score - a.score)

    // Apply relative filtering: only include notes within X% of top score
    const filteredMatches = sortedMatches.length > 0
      ? sortedMatches.filter(([, match], index) => {
          if (index === 0) return true // Always include top match
          const topScore = sortedMatches[0][1].score
          const relativeThreshold = topScore * RETRIEVAL_CONFIG.RELATIVE_THRESHOLD
          return match.score >= relativeThreshold
        })
      : []

    // Take only top K after filtering
    const finalMatches = filteredMatches.slice(0, topK)

    // 4. Fetch full note data in parallel
    const notePromises = finalMatches.map(async ([noteId, { score, matchType }]) => {
      try {
        const note = await getNoteById(noteId)
        if (!note) {
          return null
        }

        // Map images with their descriptions (already loaded from database via getNoteById)
        const imageDescriptions: Array<{ uri: string; description: string }> = note.images.map(img => ({
          uri: img.uri,
          description: img.description || ''
        }))

        const retrievedNote: RetrievedNote = {
          noteId: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags.map(t => t.name),
          images: imageDescriptions,
          audioUri: note.audioUri || undefined,
          similarityScore: score,
          matchType
        }

        return retrievedNote
      } catch (error) {
        return null
      }
    })

    // Wait for all notes to be fetched in parallel, then filter out nulls
    const retrievedNotesWithNulls = await Promise.all(notePromises)
    const retrievedNotes = retrievedNotesWithNulls.filter((note): note is RetrievedNote => note !== null)
    return retrievedNotes

  } catch (error) {
    return []
  }
}
