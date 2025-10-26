import { File, Directory, Paths } from "expo-file-system"
import * as FileSystem from "expo-file-system/legacy"

const RAG_MODEL_URL = "https://huggingface.co/anaumghori/MemoriQ-1-rag-model/resolve/main/LFM2-350M.Q5_1.gguf"
const EMBEDDING_MODEL_URL = "https://huggingface.co/unsloth/embeddinggemma-300m-GGUF/resolve/main/embeddinggemma-300m-Q4_0.gguf"
const RECALL_MODEL_URL = "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf"

const RAG_MODEL_NAME = "LFM2-350M.Q5_1.gguf"
const EMBEDDING_MODEL_NAME = "embeddinggemma-300m-Q4_0.gguf"
const RECALL_MODEL_NAME = "Qwen3-0.6B-Q8_0.gguf"

const RAG_MODEL_SIZE_MB = 273
const EMBEDDING_MODEL_SIZE_MB = 278
const RECALL_MODEL_SIZE_MB = 639

const modelDir = new Directory(Paths.document, "models")
const ragModelFile = new File(modelDir, RAG_MODEL_NAME)
const embeddingModelFile = new File(modelDir, EMBEDDING_MODEL_NAME)
const recallModelFile = new File(modelDir, RECALL_MODEL_NAME)

export type ProgressCallback = (progress: number, status: string) => void
export const getRagModelPath = (): string => ragModelFile.uri
export const getEmbeddingModelPath = (): string => embeddingModelFile.uri
export const getRecallModelPath = (): string => recallModelFile.uri
export const checkModelsExist = (): { rag: boolean; embedding: boolean; recall: boolean } => {
  try {
    return {
      rag: ragModelFile.exists,
      embedding: embeddingModelFile.exists,
      recall: recallModelFile.exists,
    }
  } catch (error) {
    return { rag: false, embedding: false, recall: false }
  }
}

export const deleteAllModels = (): void => {
  try {
    if (ragModelFile.exists) {
      ragModelFile.delete()
    }
    if (embeddingModelFile.exists) {
      embeddingModelFile.delete()
    }
    if (recallModelFile.exists) {
      recallModelFile.delete()
    }
  } catch (error) {
    // Silently handle errors in production
  }
}

export const downloadModels = async (onProgress?: ProgressCallback): Promise<void> => {
  try {
    if (!modelDir.exists) {
      modelDir.create({ intermediates: true })
    }

    const filesToDownload = [
      {
        url: RAG_MODEL_URL,
        file: ragModelFile,
        name: "RAG Model",
        sizeMB: RAG_MODEL_SIZE_MB,
      },
      {
        url: EMBEDDING_MODEL_URL,
        file: embeddingModelFile,
        name: "Embedding Model",
        sizeMB: EMBEDDING_MODEL_SIZE_MB,
      },
      {
        url: RECALL_MODEL_URL,
        file: recallModelFile,
        name: "Recall Model",
        sizeMB: RECALL_MODEL_SIZE_MB,
      },
    ]

    let totalSize = 0
    let downloadedSize = 0

    for (const fileInfo of filesToDownload) {
      totalSize += fileInfo.sizeMB * 1024 * 1024
    }

    for (const fileInfo of filesToDownload) {
      if (fileInfo.file.exists) {
        downloadedSize += fileInfo.sizeMB * 1024 * 1024

        if (onProgress) {
          const overallProgress = Math.round((downloadedSize / totalSize) * 100)
          onProgress(overallProgress, `${fileInfo.name} already downloaded`)
        }
        continue
      }

      if (onProgress) {
        const overallProgress = Math.round((downloadedSize / totalSize) * 100)
        onProgress(overallProgress, `Downloading ${fileInfo.name}...`)
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        fileInfo.url,
        fileInfo.file.uri,
        {},
        (downloadProgress) => {
          const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress
          const currentFileProgress = totalBytesWritten
          const overallProgress = ((downloadedSize + currentFileProgress) / totalSize) * 100

          if (onProgress) {
            onProgress(
              Math.round(overallProgress),
              `Downloading ${fileInfo.name}... ${Math.round((currentFileProgress / totalBytesExpectedToWrite) * 100)}%`
            )
          }
        }
      )

      const result = await downloadResumable.downloadAsync()

      if (!result) {
        throw new Error(`Download failed for ${fileInfo.name}`)
      }

      downloadedSize += fileInfo.sizeMB * 1024 * 1024
    }

    if (onProgress) {
      onProgress(100, "All models downloaded")
    }
  } catch (error) {
    throw error
  }
}