/* This module handles prompt construction for chat and quiz features */

import { RetrievedNote } from './retrieveRelevantNotes'
import { NoteWithDetails } from '../database/types'

const BASE_SYSTEM_PROMPT = `
You are an AI companion helping someone with memory loss. 
All the notes you receive are written from *their* perspective ("I went to the lake").
When you respond, always rewrite the memory from *their* point of view, 
using "you" and "your" instead of "I" and "my". 

For example:
NOTE: "I went to the park with John."
RESPONSE: "You went to the park with John."

Rules:
- Never refer to yourself as part of the memory. 
- Never say "I" when describing events from the notes.
- Be warm and supportive, but keep the focus on *their* experiences.
- If the notes don’t mention something, clearly say you don’t have information about it.

Grounding instructions:
- You must only use information explicitly present in the notes.
- If no relevant notes exist for the user's query, clearly say you don't have any notes or memories about it.
- Never invent or guess any events, people, places, or details that are not in the notes.

Your goal is to gently remind the user about their own life events using their notes.
`;

/**
 * Build system prompt with retrieved notes as context
 * @param retrievedNotes - Array of notes retrieved from similarity search
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(retrievedNotes: RetrievedNote[]): string {
  if (retrievedNotes.length === 0) {
    return BASE_SYSTEM_PROMPT + `\n\n===NOTES===\n(None found)\n\nSay you don't have memories about this.`
  }

  const topNote = retrievedNotes[0]; // Highest similarity score
  let noteText = `Title: ${topNote.title}\nContent: ${topNote.content}`;

  // Add tags, audio, image descriptions if present
  if (topNote.tags.length > 0) {
    noteText += `\nTags: ${topNote.tags.join(', ')}`;
  }
  if (topNote.audioUri) {
    noteText += `\n[Audio attached]`;
  }
  if (topNote.images.length > 0) {
    const descriptionsWithContent = topNote.images.filter(img => img.description && img.description.trim().length > 0);
    if (descriptionsWithContent.length > 0) {
      noteText += `\n\nImages:`;
      descriptionsWithContent.forEach((img, idx) => {
        noteText += `\n- Image ${idx + 1}: ${img.description}`;
      });
    }
  }

  const fullPrompt = `${BASE_SYSTEM_PROMPT}\n\n===NOTES===\n${noteText}\n\nAnswer the user's question using the information from the note above. Include specific details and relevant information that will help them remember. Be conversational and natural in your response.`;
  return fullPrompt
}

/**
 * Build quiz prompt for generating a question from a note
 * @param note - Note to generate question from
 * @returns Prompt string for quiz question generation
 */
export function buildQuizPrompt(note: NoteWithDetails): string {
  let noteContent = `Title: ${note.title}\nContent: ${note.content}`

  // Add tags if present
  if (note.tags.length > 0) {
    noteContent += `\nTags: ${note.tags.map(t => t.name).join(', ')}`
  }

  // Add image descriptions if present
  if (note.images.length > 0) {
    const descriptionsWithContent = note.images.filter(img => img.description && img.description.trim().length > 0)
    if (descriptionsWithContent.length > 0) {
      noteContent += `\n\nImages:`
      descriptionsWithContent.forEach((img, idx) => {
        noteContent += `\n- Image ${idx + 1}: ${img.description}`
      })
    }
  }

  const quizPrompt = `You are helping create a memory quiz for someone with memory loss. Based on the following note from their personal memory journal, create ONE multiple-choice question to help them practice recalling this memory.

===NOTE===
${noteContent}

INSTRUCTIONS:
- Create a specific question about a detail from this note (what happened, who was there, where it was, when it occurred, etc.)
- Provide exactly TWO answer options (A and B)
- One option should be correct based on the note
- The other option should be plausible but incorrect
- Keep the question clear and specific

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact schema:
{
  "question": "string - the quiz question",
  "optionA": "string - first answer option",
  "optionB": "string - second answer option",
  "correct": "string - either 'A' or 'B'"
}

Generate the quiz question as JSON now:`

  return quizPrompt
}