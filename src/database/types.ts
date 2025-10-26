// Database model interfaces

export interface Note {
  id: number
  title: string
  content: string
  audioUri: string | null
  recallScript: string | null
  lastShownInReminisce: number | null
  createdAt: number
  updatedAt: number
}

export interface Tag {
  id: number
  name: string
}

export interface Image {
  id: number
  noteId: number
  uri: string
  description: string
}

// Extended note with all related data (for UI display)
export interface NoteWithDetails extends Note {
  tags: Tag[]
  images: Image[]
}

// Input types for CRUD operations

export interface CreateNoteInput {
  title: string
  content: string
  tags: string[] // Array of tag names
  images: Array<{ uri: string; description: string }> // Array of images with optional descriptions
  audioUri: string | null
}

export interface UpdateNoteInput {
  id: number
  title: string
  content: string
  tags: string[]
  images: Array<{ uri: string; description: string }> // Array of images with optional descriptions
  audioUri: string | null
}
