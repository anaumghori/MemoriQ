/* This module handles automatic generation of recall scripts for notes. Scripts are computed in the background when notes are created or updated. */

import { getDatabaseInstance } from '../database'
import { getNoteById } from '../database/notesOperations'
import ModelManager from '../model/ModelManager'

/* Check if recall model is ready before processing */
async function ensureRecallModelReady(): Promise<boolean> {
  const recallReady = ModelManager.isRecallReady()

  if (!recallReady) {
    return false
  }

  return true
}

/* Generate recall script for a note using LLM */
async function generateRecallScript(noteId: number): Promise<void> {
  const db = getDatabaseInstance()

  try {
    // Get note data
    const note = await getNoteById(noteId)
    if (!note) {
      return
    }

    // Get recall model context
    const recallContext = ModelManager.getRecallContext()
    if (!recallContext) {
      throw new Error('Recall model context not available')
    }

    const userPrompt = `
    Write a recall script based entirely on the note below. Follow these rules:
    1. Output only the script — no intro/outro or extra commentary. Avoid any questions or framing text, the output must be just the script itself.
    2. Begin by summarizing what the memory is about, then include all important details. The first sentence(s) should clearly state what the memory is about.
    3. Include all important details from the note (events, people, locations, actions, sensory details).
    4. Use "you" and "your" when describing the memory. Never use "I".
    5. Speak gently and warmly, but do NOT ask questions or add intros/outros.
    6. Do not invent anything that is not present in the note.
    Memory: "${note.title}"
    Details: ${note.content}
    Write the recall script now: `;

    // Generate script using recall model
    const result = await recallContext.completion({
      messages: [
        {
          role: "system",
          content: `You are a caring companion helping someone with memory loss reconnect with their memories.
          Create warm scripts based only on the details provided in the note.
          Begin by summarizing what the memory is about, then include all important details. The first sentence(s) should clearly state what the memory is about.
          Never invent new events, names, or places that are not present in the note.
          If the note lacks enough detail, keep the script brief and gently acknowledge that.
          Use simple, comforting language, and speak directly to the person as "you".`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      n_predict: 260,
      temperature: 0.3,
      top_p: 0.85,
      top_k: 40,
      stop: ["</s>", "<|end|>", "<|eot_id|>", "<|end_of_text|>", "<|im_end|>", "\n\n\n"]
    })

    const recallScript = result.text.trim()

    if (!recallScript || recallScript.length === 0) {
      throw new Error('Empty recall script returned')
    }

    // Store script in database
    await db.execute(
      'UPDATE notes SET recallScript = ? WHERE id = ?',
      [recallScript, noteId]
    )

  } catch (error) {
    // Error in script generation - fail silently
  }
}

/* Process recall script for a note. This is the main entry point called after note creation/update */
export async function processRecallScript(noteId: number): Promise<void> {
  try {
    const recallReady = await ensureRecallModelReady()
    if (!recallReady) {
      return
    }

    await generateRecallScript(noteId)
  } catch (error) {
    // Don't throw - fail silently in background
  }
}

/* Update recall script for an edited note */
const pendingScriptNotes = new Set<number>()
let scriptUpdateTimer: ReturnType<typeof setTimeout> | null = null

export async function updateRecallScript(noteId: number): Promise<void> {
  pendingScriptNotes.add(noteId)

  if (scriptUpdateTimer) {
    return
  }

  scriptUpdateTimer = setTimeout(async () => {
    const ids = Array.from(pendingScriptNotes)
    pendingScriptNotes.clear()
    scriptUpdateTimer = null

    try {
      const recallReady = await ensureRecallModelReady()
      if (!recallReady) {
        return
      }

      await Promise.all(
        ids.map(async (id) => {
          const note = await getNoteById(id)
          if (!note) return
          await processRecallScript(id)
        })
      )
    } catch {
      // Silent fail; background task
    }
  }, 300)
}
