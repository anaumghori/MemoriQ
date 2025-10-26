/* This module handles note selection for reminisce sessions */

import { getAllNotes } from '../database/notesOperations'
import { type NoteWithDetails } from '../database/types'
import { getDatabaseInstance } from '../database'

/* Calculate age of note in days */
function ageInDays(note: NoteWithDetails): number {
  const now = Date.now()
  const created = note.createdAt
  const ageMs = now - created
  return Math.floor(ageMs / (1000 * 60 * 60 * 24))
}

/* Calculate days since note was last shown in reminisce session */
function daysSinceLastShown(note: NoteWithDetails): number {
  if (!note.lastShownInReminisce) {
    return 9999
  }
  const now = Date.now()
  const lastShown = note.lastShownInReminisce
  const diffMs = now - lastShown
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/* Shuffle array using Fisher-Yates algorithm */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/* Select notes for reminisce session based on value scoring */
export async function selectReminisceNotes(count: number): Promise<NoteWithDetails[]> {
  const allNotes = await getAllNotes()

  if (allNotes.length === 0) {
    return []
  }

  if (allNotes.length <= count) {
    return shuffle(allNotes)
  }

  const scored = allNotes.map(note => ({
    note,
    score:
      (note.images.length > 0 ? 50 : 0) +
      (ageInDays(note) * 0.5) +
      (note.content.length * 0.01) +
      (daysSinceLastShown(note) * 2) +
      (note.recallScript ? 10 : -100)
  }))

  return shuffle(
    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.note)
  )
}

/* Update lastShownInReminisce timestamp for a note */
export async function markNoteAsShown(noteId: number): Promise<void> {
  const db = getDatabaseInstance()
  const now = Date.now()

  try {
    await db.execute(
      'UPDATE notes SET lastShownInReminisce = ? WHERE id = ?',
      [now, noteId]
    )
  } catch (error) {
    // Error updating lastShownInReminisce - fail silently
  }
}

/* Update lastShownInReminisce for multiple notes */
export async function markNotesAsShown(noteIds: number[]): Promise<void> {
  for (const noteId of noteIds) {
    await markNoteAsShown(noteId)
  }
}
