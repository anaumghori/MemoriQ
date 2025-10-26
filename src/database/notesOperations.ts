/* Helper database related functions for Notes */

import { type DB, type QueryResult } from '@op-engineering/op-sqlite'
import { getDatabaseInstance } from './index'
import { Note, Tag, Image, NoteWithDetails, CreateNoteInput, UpdateNoteInput } from './types'
import { processNoteEmbeddings, updateNoteEmbeddings } from '../lib/createNoteEmbeddings'
import { processRecallScript, updateRecallScript } from '../lib/recallScriptGenerator'

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${month} ${day} • ${time}`
}

/* Get or create a tag by name. Returns the tag ID */
async function getOrCreateTag(db: DB, name: string): Promise<number> {
  const result = await db.execute('SELECT id FROM tags WHERE name = ?', [name])
  const existingTag = result.rows?.[0] as { id: number } | undefined
  if (existingTag) {
    return existingTag.id
  }
  const insertResult = await db.execute('INSERT INTO tags (name) VALUES (?)', [name])
  return insertResult.insertId!
}

/* Get all tags for a specific note */
async function getTagsForNote(db: DB, noteId: number): Promise<Tag[]> {
  const result = await db.execute(
    `SELECT t.id, t.name
     FROM tags t
     INNER JOIN note_tags nt ON t.id = nt.tagId
     WHERE nt.noteId = ?`,
    [noteId]
  )
  return (result.rows || []) as unknown as Tag[]
}

/* Get all images for a note */
async function getImagesForNote(db: DB, noteId: number): Promise<Image[]> {
  const result = await db.execute(
    'SELECT id, noteId, uri, description FROM images WHERE noteId = ?',
    [noteId]
  )
  return (result.rows || []) as unknown as Image[]
}


/* Link tags, images, audio to a note (creates tags if they don't exist) */
async function linkTagsToNote(
  db: DB,
  noteId: number,
  tagNames: string[]
): Promise<void> {
  for (const tagName of tagNames) {
    const tagId = await getOrCreateTag(db, tagName)
    await db.execute('INSERT INTO note_tags (noteId, tagId) VALUES (?, ?)', [noteId, tagId])
  }
}

async function linkImagesToNote(
  db: DB,
  noteId: number,
  images: Array<{ uri: string; description: string }>
): Promise<void> {
  for (const image of images) {
    await db.execute('INSERT INTO images (noteId, uri, description) VALUES (?, ?, ?)', [noteId, image.uri, image.description])
  }
}


/* Remove all tags, images and audio from a note */
async function removeAllTagsFromNote(db: DB, noteId: number): Promise<void> {
  await db.execute('DELETE FROM note_tags WHERE noteId = ?', [noteId])
}
async function removeAllImagesFromNote(db: DB, noteId: number): Promise<void> {
  await db.execute('DELETE FROM images WHERE noteId = ?', [noteId])
}


/* Build a complete NoteWithDetails object from a Note */
async function buildNoteWithDetails(db: DB, note: Note): Promise<NoteWithDetails> {
  const tags = await getTagsForNote(db, note.id)
  const images = await getImagesForNote(db, note.id)
  return {...note, tags, images }
}

/* Create a new note with tags, images, and audio */
export async function createNote(input: CreateNoteInput): Promise<number> {
  const db = getDatabaseInstance()
  let noteId: number = 0
  try {
    await db.transaction(async (tx) => {
      const now = Date.now()
      const result = await tx.execute(
        'INSERT INTO notes (title, content, audioUri, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [input.title, input.content, input.audioUri, now, now]
      )
      noteId = result.insertId!

      // Process tags
      if (input.tags.length > 0) {
        for (const tagName of input.tags) {
          const tagResult = await tx.execute('SELECT id FROM tags WHERE name = ?', [tagName])
          let tagId: number

          if (tagResult.rows?.[0]) {
            tagId = (tagResult.rows[0] as unknown as { id: number }).id
          } else {
            const insertTagResult = await tx.execute('INSERT INTO tags (name) VALUES (?)', [tagName])
            tagId = insertTagResult.insertId!
          }
          await tx.execute('INSERT INTO note_tags (noteId, tagId) VALUES (?, ?)', [noteId, tagId])
        }
      }

      // Process images
      if (input.images.length > 0) {
        for (const image of input.images) {
          await tx.execute('INSERT INTO images (noteId, uri, description) VALUES (?, ?, ?)', [noteId, image.uri, image.description])
        }
      }
    })

    // Trigger embedding pipeline first, then recall script (sequential to avoid context conflicts)
    processNoteEmbeddings(noteId).then(() => {
      processRecallScript(noteId)
    })
    return noteId
  } catch (error) {
    throw error
  }
}

/* Get all notes with their associated data */
export async function getAllNotes(): Promise<NoteWithDetails[]> {
  const db = getDatabaseInstance()
  try {
    const result = await db.execute(
      'SELECT id, title, content, audioUri, recallScript, lastShownInReminisce, createdAt, updatedAt FROM notes ORDER BY createdAt DESC'
    )
    const notes = (result.rows || []) as unknown as Note[]

    const notesWithDetails: NoteWithDetails[] = []
    for (const note of notes) {
      const noteWithDetails = await buildNoteWithDetails(db, note)
      notesWithDetails.push(noteWithDetails)
    }
    return notesWithDetails
  } catch (error) {
    throw error
  }
}

/* Get a single note by ID with all details */
export async function getNoteById(id: number): Promise<NoteWithDetails | null> {
  const db = getDatabaseInstance()
  try {
    const result = await db.execute(
      'SELECT id, title, content, audioUri, recallScript, lastShownInReminisce, createdAt, updatedAt FROM notes WHERE id = ?',
      [id]
    )
    const note = result.rows?.[0] as unknown as Note | undefined
    if (!note) {
      return null
    }
    return await buildNoteWithDetails(db, note)
  } catch (error) {
    throw error
  }
}

/* Update an existing note */
export async function updateNote(input: UpdateNoteInput): Promise<void> {
  const db = getDatabaseInstance()
  try {
    await db.transaction(async (tx) => {
      const now = Date.now()
      await tx.execute('UPDATE notes SET title = ?, content = ?, audioUri = ?, updatedAt = ? WHERE id = ?', [input.title, input.content, input.audioUri, now, input.id])
      await tx.execute('DELETE FROM note_tags WHERE noteId = ?', [input.id])
      await tx.execute('DELETE FROM images WHERE noteId = ?', [input.id])

      // Add new tags
      if (input.tags.length > 0) {
        for (const tagName of input.tags) {
          const tagResult = await tx.execute('SELECT id FROM tags WHERE name = ?', [tagName])
          let tagId: number
          if (tagResult.rows?.[0]) {
            tagId = (tagResult.rows[0] as unknown as { id: number }).id
          } else {
            const insertTagResult = await tx.execute('INSERT INTO tags (name) VALUES (?)', [tagName])
            tagId = insertTagResult.insertId!
          }
          await tx.execute('INSERT INTO note_tags (noteId, tagId) VALUES (?, ?)', [input.id, tagId])
        }
      }
      if (input.images.length > 0) {
        for (const image of input.images) {
          await tx.execute('INSERT INTO images (noteId, uri, description) VALUES (?, ?, ?)', [input.id, image.uri, image.description])
        }
      }
    })

    // Trigger embedding update first, then recall script (sequential to avoid context conflicts)
    updateNoteEmbeddings(input.id).then(() => {
      updateRecallScript(input.id)
    })
  } catch (error) {
    throw error
  }
}

/* Delete a note */
export async function deleteNote(id: number): Promise<void> {
  const db = getDatabaseInstance()
  try {
    await db.execute('DELETE FROM notes WHERE id = ?', [id])
  } catch (error) {
    throw error
  }
}

/* Search notes by query string (title, content, and tag names). Returns notes sorted by creation date (newest first) */
export async function searchNotes(query: string): Promise<NoteWithDetails[]> {
  const db = getDatabaseInstance()

  try {
    const searchPattern = `%${query}%`
    const result = await db.execute(
      `SELECT DISTINCT n.id, n.title, n.content, n.audioUri, n.recallScript, n.lastShownInReminisce, n.createdAt, n.updatedAt
       FROM notes n
       LEFT JOIN note_tags nt ON n.id = nt.noteId
       LEFT JOIN tags t ON nt.tagId = t.id
       WHERE n.title LIKE ? OR n.content LIKE ? OR t.name LIKE ?
       ORDER BY n.createdAt DESC`,
      [searchPattern, searchPattern, searchPattern]
    )
    const notes = (result.rows || []) as unknown as Note[]

    const notesWithDetails: NoteWithDetails[] = []
    for (const note of notes) {
      const noteWithDetails = await buildNoteWithDetails(db, note)
      notesWithDetails.push(noteWithDetails)
    }
    return notesWithDetails
  } catch (error) {
    throw error
  }
}

/* Convert NoteWithDetails to UI format Formats timestamp and prepares data for display */
export function formatNoteForUI(note: NoteWithDetails): {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
} {
  return {
    id: note.id.toString(),
    title: note.title,
    content: note.content,
    tags: note.tags.map((tag) => tag.name),
    createdAt: formatTimestamp(note.createdAt),
  }
}