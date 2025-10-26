import { initLlama, LlamaContext } from "llama.rn"
import { getRagModelPath, getEmbeddingModelPath, getRecallModelPath, checkModelsExist, downloadModels, type ProgressCallback} from "./modelStorage"

class ModelManager {
  private static instance: ModelManager
  private ragContext: LlamaContext | null = null
  private embeddingContext: LlamaContext | null = null
  private recallContext: LlamaContext | null = null
  private ragLoaded: boolean = false
  private embeddingLoaded: boolean = false
  private recallLoaded: boolean = false

  private constructor() {}

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager()
    }
    return ModelManager.instance
  }

  static async initialize(progressCallback?: ProgressCallback): Promise<boolean> {
    const instance = ModelManager.getInstance()

    try {
      const exists = checkModelsExist()
      if (!exists.rag || !exists.embedding || !exists.recall) {
        await downloadModels(progressCallback)
      }
      if (progressCallback) progressCallback(25, "Loading RAG model...")

      const ragPath = getRagModelPath()

      instance.ragContext = await initLlama({
        model: ragPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 0,
        ctx_shift: false,
        use_progress_callback: true,
      })

      instance.ragLoaded = true
      if (progressCallback) progressCallback(50, "Loading embedding model...")
      const embeddingPath = getEmbeddingModelPath()

      instance.embeddingContext = await initLlama({
        model: embeddingPath,
        use_mlock: true,
        n_ctx: 512,
        n_gpu_layers: 0,
        embedding: true,
        use_progress_callback: true,
      })

      instance.embeddingLoaded = true
      if (progressCallback) progressCallback(75, "Loading recall model...")
      const recallPath = getRecallModelPath()

      instance.recallContext = await initLlama({
        model: recallPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 0,
        ctx_shift: false,
        use_progress_callback: true,
      })

      instance.recallLoaded = true
      if (progressCallback) progressCallback(100, "Models ready!")

      return true
    } catch (error) {
      return false
    }
  }

  static getRagContext(): LlamaContext | null {
    return ModelManager.getInstance().ragContext
  }

  static getExtractContext(): LlamaContext | null {
    return ModelManager.getInstance().recallContext
  }

  static getEmbeddingContext(): LlamaContext | null {
    return ModelManager.getInstance().embeddingContext
  }

  static getRecallContext(): LlamaContext | null {
    return ModelManager.getInstance().recallContext
  }

  static isRagReady(): boolean {
    return ModelManager.getInstance().ragLoaded
  }

  static isExtractReady(): boolean {
    return ModelManager.getInstance().recallLoaded
  }

  static isEmbeddingReady(): boolean {
    return ModelManager.getInstance().embeddingLoaded
  }

  static isRecallReady(): boolean {
    return ModelManager.getInstance().recallLoaded
  }

  static async unloadAll(): Promise<void> {
    const instance = ModelManager.getInstance()

    if (instance.ragContext) {
      await instance.ragContext.release()
      instance.ragContext = null
      instance.ragLoaded = false
    }

    if (instance.embeddingContext) {
      await instance.embeddingContext.release()
      instance.embeddingContext = null
      instance.embeddingLoaded = false
    }

    if (instance.recallContext) {
      await instance.recallContext.release()
      instance.recallContext = null
      instance.recallLoaded = false
    }
  }
}

export default ModelManager