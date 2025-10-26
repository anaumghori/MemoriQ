import ModelManager from '../model/ModelManager'

/**
 * Generate embedding for user query (text-only)
 * @param text - The user's text query
 * @returns Object containing embedding and processed text, or null if generation fails
 */
export async function generateQueryEmbedding(
  text: string
): Promise<{
  embedding: Float32Array
  processedText: string
} | null> {
  try {
    const embeddingContext = ModelManager.getEmbeddingContext()
    if (!embeddingContext) {
      return null
    }
    const processedText = text.trim()
    const embeddingResult = await embeddingContext.embedding(processedText)  // Generate embedding for the text
    if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
      return null
    }

    const embedding = new Float32Array(embeddingResult.embedding) // Convert to Float32Array
    return {
      embedding,
      processedText
    }

  } catch (error) {
    return null
  }
}
