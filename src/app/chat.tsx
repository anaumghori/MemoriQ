import { useReducer, useRef, useMemo, useEffect, memo, useCallback } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import Header from "../components/Header"
import { cn } from "../lib/utils"
import { useApp } from "../lib/appContext"
import ModelManager from "../model/ModelManager"
import { generateQueryEmbedding } from "../lib/createQueryEmbedding"
import { retrieveRelevantNotes } from "../lib/retrieveRelevantNotes"
import { buildSystemPrompt } from "../lib/buildPrompts"
import { useKeyboard } from "../lib/useKeyboard"

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  timestamp: Date
}

interface ChatState {
  messages: Message[]
  inputText: string
  isGenerating: boolean
}

type ChatAction =
  | { type: 'SET_INPUT'; text: string }
  | { type: 'ADD_USER'; message: Message }
  | { type: 'ADD_AI_PLACEHOLDER'; id: string }
  | { type: 'UPDATE_AI_TEXT'; id: string; text: string }
  | { type: 'FINALIZE_AI_TEXT'; id: string; text: string }
  | { type: 'SET_GENERATING'; value: boolean }

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, inputText: action.text }
    case 'ADD_USER':
      return { ...state, messages: [...state.messages, action.message] }
    case 'ADD_AI_PLACEHOLDER':
      return {
        ...state,
        messages: [...state.messages, { id: action.id, text: '', sender: 'ai', timestamp: new Date() }],
      }
    case 'UPDATE_AI_TEXT':
      return {
        ...state,
        messages: state.messages.map(m => (m.id === action.id ? { ...m, text: action.text } : m)),
      }
    case 'FINALIZE_AI_TEXT':
      return {
        ...state,
        messages: state.messages.map(m => (m.id === action.id ? { ...m, text: action.text } : m)),
      }
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.value }
    default:
      return state
  }
}

interface MessageBubbleProps {
  message: Message
}

const MessageBubble = memo(({ message }: MessageBubbleProps) => (
  <View
    className={cn("mb-3 max-w-[85%]", message.sender === "user" ? "self-end" : "self-start")}
  >
    <View
      className={cn("rounded-2xl px-4 py-2.5",
        message.sender === "user"
          ? "bg-emerald-600"
          : "bg-white border border-emerald-500"
      )}
    >
      <Text
        className={cn("text-[17px] leading-6",
          message.sender === "user" ? "text-white" : "text-gray-900"
        )}
      >
        {message.text}
      </Text>
    </View>
    <Text className={cn("text-gray-500 text-xs mt-1 px-2")}> {message.timestamp.toLocaleTimeString()} </Text>
  </View>
))

export default function ChatPage() {
  const [{ messages, inputText, isGenerating }, dispatch] = useReducer(chatReducer, {
    messages: [],
    inputText: '',
    isGenerating: false,
  })
  const { height: keyboardHeight } = useKeyboard()

  const scrollViewRef = useRef<ScrollView>(null)
  const router = useRouter()
  const messagesContainerStyle = useMemo(() => ({ paddingTop: 12, paddingBottom: 12 }), [])
  const flushRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      // flush any pending streamed tokens before unmount
      flushRef.current?.()
      flushRef.current = null
    }
  }, [])

  const handleSend = async () => {
    const ragContext = ModelManager.getRagContext()
    const embeddingContext = ModelManager.getEmbeddingContext()

    if (!inputText.trim() || !ragContext || !embeddingContext || isGenerating) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: "user",
      timestamp: new Date(),
    }

    dispatch({ type: 'ADD_USER', message: userMessage })
    dispatch({ type: 'SET_INPUT', text: '' })
    dispatch({ type: 'SET_GENERATING', value: true })

    // Dismiss keyboard after sending
    Keyboard.dismiss()

    // Create AI message placeholder
    const aiMessageId = (Date.now() + 1).toString()
    dispatch({ type: 'ADD_AI_PLACEHOLDER', id: aiMessageId })

    try {
      // Step 1: Generate query embedding
      dispatch({ type: 'UPDATE_AI_TEXT', id: aiMessageId, text: 'Searching memories...' })

      const queryResult = await generateQueryEmbedding(userMessage.text)

      if (!queryResult) {
        throw new Error("Failed to generate query embedding")
      }

      // Step 2: Retrieve relevant notes
      const retrievedNotes = await retrieveRelevantNotes(queryResult.embedding, 3)

      // Step 3: Build system prompt with context
      const systemPrompt = buildSystemPrompt(retrievedNotes)

      // Step 4: Generate response with RAG context
      dispatch({ type: 'UPDATE_AI_TEXT', id: aiMessageId, text: '' })

      let fullResponse = ""
      let pendingBuffer = ""
      let scheduled = false

      const flush = () => {
        if (!pendingBuffer) return
        fullResponse += pendingBuffer
        pendingBuffer = ""
        dispatch({ type: 'UPDATE_AI_TEXT', id: aiMessageId, text: fullResponse })
        scheduled = false
      }

      const result = await ragContext.completion(
        {
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userMessage.text
            }
          ],
          n_predict: 512,
          temperature: 0.5,
          top_p: 0.9,
          min_p: 0.05,
          stop: ["</s>", "<|end|>", "<|eot_id|>", "<|end_of_text|>", "<|im_end|>"],
        },
        (data: { token?: string }) => {
          const token = data.token || ''
          pendingBuffer += token
          if (!scheduled) {
            scheduled = true
            // throttle updates to roughly each frame
            requestAnimationFrame(flush)
          }
        }
      )
      // expose flush for unmount cleanup during streaming
      flushRef.current = flush

      const finalText = result.text || fullResponse

      // Ensure any pending tokens are flushed, then set final
      if (pendingBuffer) {
        fullResponse += pendingBuffer
        pendingBuffer = ''
      }
      dispatch({ type: 'FINALIZE_AI_TEXT', id: aiMessageId, text: finalText.trim() })

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to process your question. Please try again.'
      dispatch({ type: 'FINALIZE_AI_TEXT', id: aiMessageId, text: `Error: ${msg}` })
    } finally {
      dispatch({ type: 'SET_GENERATING', value: false })
    }
  }

  // Check if models are ready from AppContext
  const { modelsReady } = useApp()

  if (!modelsReady) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="Chat with Memories" backPath="/" />
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-6 text-center")}> Loading AI models... </Text>
          <Text className={cn("text-gray-500 text-sm text-center mt-2")}>
            Please wait while the models are being initialized
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // Chat interface
  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <Header title="Chat with Memories" backPath="/" />

      <View className={cn("flex-1")}>
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className={cn("flex-1 px-4")}
          contentContainerStyle={messagesContainerStyle}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View className={cn("flex-1 items-center justify-center py-20")}>
              <Text className={cn("text-gray-500 text-lg text-center")}> Ask me about your memories! </Text>
            </View>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isGenerating && (
            <View className={cn("flex-row items-center mb-3 self-start")}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text className={cn("text-gray-600 text-sm ml-2 font-medium")}> Thinking... </Text>
            </View>
          )}
        </ScrollView>

        {/* Input area - now with dynamic bottom padding */}
        <View
          className={cn("px-4 pb-4 pt-3 bg-white border-t border-gray-200")}
          style={{ marginBottom: keyboardHeight }}
        >
          <View className={cn("flex-row items-end gap-2.5")}>
            <TextInput
              value={inputText}
              onChangeText={(t) => dispatch({ type: 'SET_INPUT', text: t })}
              placeholder="Ask about your memories..."
              placeholderTextColor="#9ca3af"
              className={cn("flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-gray-900 text-base border border-gray-200"
              )}
              style={{ minHeight: 44, maxHeight: 100 }}
              multiline
              maxLength={500}
              editable={!isGenerating}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || isGenerating}
              className={cn("bg-emerald-600 rounded-full w-11 h-11 items-center justify-center mb-0.5",
                (!inputText.trim() || isGenerating) && "opacity-50"
              )}
            >
              <Ionicons name="send" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
