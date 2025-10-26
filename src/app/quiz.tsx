import { useReducer, useEffect } from "react"
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import Header from "../components/Header"
import { cn } from "../lib/utils"
import { useApp } from "../lib/appContext"
import ModelManager from "../model/ModelManager"
import { getAllNotes } from "../database/notesOperations"
import { NoteWithDetails } from "../database/types"
import { buildQuizPrompt } from "../lib/buildPrompts"

type Question = {
  id: string
  question: string
  optionA: string
  optionB: string
  correctAnswer: "A" | "B"
}

const TOTAL_QUESTIONS = 5

interface QuizState {
  questions: (Question | null)[]
  selectedNotes: NoteWithDetails[]
  noteAssignments: number[]
  currentQuestionIndex: number
  selectedAnswer: "A" | "B" | null
  showResult: boolean
  score: number
  answeredQuestions: number
  isGenerating: boolean
  hasError: boolean
  errorMessage: string
  initialized: boolean
}

type QuizAction =
  | { type: 'INIT_SUCCESS'; payload: { notes: NoteWithDetails[]; assignments: number[] } }
  | { type: 'INIT_ERROR'; message: string }
  | { type: 'SET_QUESTION'; index: number; question: Question }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SELECT_ANSWER'; answer: "A" | "B" }
  | { type: 'SHOW_RESULT' }
  | { type: 'INCREMENT_SCORE' }
  | { type: 'NEXT_QUESTION' }

const initialQuizState: QuizState = {
  questions: Array(TOTAL_QUESTIONS).fill(null),
  selectedNotes: [],
  noteAssignments: [],
  currentQuestionIndex: 0,
  selectedAnswer: null,
  showResult: false,
  score: 0,
  answeredQuestions: 0,
  isGenerating: false,
  hasError: false,
  errorMessage: '',
  initialized: false,
}

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'INIT_SUCCESS':
      return {
        ...state,
        selectedNotes: action.payload.notes,
        noteAssignments: action.payload.assignments,
        initialized: true,
      }
    case 'INIT_ERROR':
      return {
        ...state,
        hasError: true,
        errorMessage: action.message,
      }
    case 'SET_QUESTION':
      const updatedQuestions = [...state.questions]
      updatedQuestions[action.index] = action.question
      return {
        ...state,
        questions: updatedQuestions,
      }
    case 'SET_GENERATING':
      return {
        ...state,
        isGenerating: action.value,
      }
    case 'SELECT_ANSWER':
      return {
        ...state,
        selectedAnswer: action.answer,
      }
    case 'SHOW_RESULT':
      const isCorrect = state.selectedAnswer === state.questions[state.currentQuestionIndex]?.correctAnswer
      return {
        ...state,
        showResult: true,
        answeredQuestions: state.answeredQuestions + 1,
        score: isCorrect ? state.score + 1 : state.score,
      }
    case 'NEXT_QUESTION':
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        selectedAnswer: null,
        showResult: false,
      }
    default:
      return state
  }
}

export default function QuizPage() {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState)
  const {
    questions,
    selectedNotes,
    noteAssignments,
    currentQuestionIndex,
    selectedAnswer,
    showResult,
    score,
    answeredQuestions,
    isGenerating,
    hasError,
    errorMessage,
    initialized,
  } = state

  const router = useRouter()
  const { modelsReady } = useApp()
  const currentQuestion = questions[currentQuestionIndex]
  const isCorrect = selectedAnswer === currentQuestion?.correctAnswer

  // Initialize quiz: select notes and start generating first question
  useEffect(() => {
    async function initializeQuiz() {
      try {
        const extractContext = ModelManager.getExtractContext()
        if (!extractContext) {
          dispatch({ type: 'INIT_ERROR', message: "AI model not ready" })
          return
        }

        const allNotes = await getAllNotes()

        if (allNotes.length === 0) {
          dispatch({ type: 'INIT_ERROR', message: "No notes available. Please create some notes first." })
          return
        }

        // Shuffle and select notes
        const shuffled = [...allNotes].sort(() => Math.random() - 0.5)
        const noteCount = shuffled.length

        // Determine how many questions per note
        let assignments: number[] = []
        if (noteCount >= TOTAL_QUESTIONS) {
          // 1 question per note, take first 5 notes
          assignments = [0, 1, 2, 3, 4]
        } else if (noteCount >= 3) {
          // Distribute questions among available notes
          for (let i = 0; i < TOTAL_QUESTIONS; i++) {
            assignments.push(i % noteCount)
          }
        } else {
          // Use available notes repeatedly
          for (let i = 0; i < TOTAL_QUESTIONS; i++) {
            assignments.push(i % noteCount)
          }
        }

        const selectedNotesSlice = shuffled.slice(0, Math.min(noteCount, TOTAL_QUESTIONS))
        dispatch({
          type: 'INIT_SUCCESS',
          payload: {
            notes: selectedNotesSlice,
            assignments,
          }
        })

        // Start generating first question
        generateQuestion(0, selectedNotesSlice, assignments)
      } catch (error) {
        dispatch({ type: 'INIT_ERROR', message: "Failed to initialize quiz" })
      }
    }

    initializeQuiz()
  }, [])

  // Parse model response into structured question
  function parseQuestionResponse(response: string, questionIndex: number): Question | null {
    try{
      // Clean the response to extract JSON
      let jsonStr = response.trim()

      // Try to find JSON object in the response
      const jsonStart = jsonStr.indexOf('{')
      const jsonEnd = jsonStr.lastIndexOf('}')

      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1)
      }

      const parsed = JSON.parse(jsonStr)

      // Normalize field names to handle model variations (optiona vs optionA, question2 vs question, etc.)
      const normalizeField = (obj: any, baseNames: string[]): string | undefined => {
        // First try exact matches
        for (const baseName of baseNames) {
          if (obj[baseName]) return obj[baseName]
        }

        // Then try to find fields with numbers appended (e.g., question2, optiona3)
        for (const key of Object.keys(obj)) {
          const keyLower = key.toLowerCase()
          for (const baseName of baseNames) {
            const baseNameLower = baseName.toLowerCase()
            // Check if key starts with baseName (ignoring case) and ends with optional numbers
            if (keyLower === baseNameLower || keyLower.match(new RegExp(`^${baseNameLower}\\d*$`))) {
              return obj[key]
            }
          }
        }

        return undefined
      }

      const question = normalizeField(parsed, ['question', 'Question'])
      const optionA = normalizeField(parsed, ['optionA', 'optiona', 'OptionA'])
      const optionB = normalizeField(parsed, ['optionB', 'optionb', 'OptionB'])
      const correct = normalizeField(parsed, ['correct', 'Correct'])

      // Normalize correct answer to uppercase
      const correctNormalized = correct?.toUpperCase()

      // Validate parsed data
      if (!question || !optionA || !optionB || (correctNormalized !== "A" && correctNormalized !== "B")) {
        return null
      }
      return {
        id: Date.now().toString() + Math.random(),
        question,
        optionA,
        optionB,
        correctAnswer: correctNormalized as "A" | "B"
      }
    } catch (error) {
      return null
    }
  }

  // Generate a single question
  async function generateQuestion(index: number, notes: NoteWithDetails[], assignments: number[]) {
    if (isGenerating || questions[index] !== null) {
      return
    }

    dispatch({ type: 'SET_GENERATING', value: true })
    const startTime = Date.now()

    try {
      const extractContext = ModelManager.getExtractContext()
      if (!extractContext) {
        throw new Error("AI model not available")
      }

      const noteIndex = assignments[index]
      const note = notes[noteIndex]

      const prompt = buildQuizPrompt(note)

      const result = await extractContext.completion({
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates quiz questions in valid JSON format. Always respond with complete, valid JSON objects only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        n_predict: 300,
        temperature: 0.1,
        top_p: 0.95,
        top_k: 40,
        stop: ["</s>", "<|end|>", "<|eot_id|>", "<|end_of_text|>", "<|im_end|>", "\n\n\n"],
      })

      const parsedQuestion = parseQuestionResponse(result.text, index)

      if (parsedQuestion) {
        dispatch({ type: 'SET_QUESTION', index, question: parsedQuestion })

        // Start generating next question in background
        if (index < TOTAL_QUESTIONS - 1) {
          setTimeout(() => generateQuestion(index + 1, notes, assignments), 100)
        }
      }
    } catch (error) {
      // Generation error - fail silently
    } finally {
      dispatch({ type: 'SET_GENERATING', value: false })
    }
  }

  // Trigger next question generation if needed
  useEffect(() => {
    if (!initialized || selectedNotes.length === 0) return

    const nextIndex = currentQuestionIndex + 1
    if (nextIndex < TOTAL_QUESTIONS && questions[nextIndex] === null && !isGenerating) {
      generateQuestion(nextIndex, selectedNotes, noteAssignments)
    }
  }, [currentQuestionIndex, initialized, selectedNotes, noteAssignments, questions, isGenerating])

  const handleAnswerSelect = (answer: "A" | "B") => {
    if (showResult || !currentQuestion) return

    dispatch({ type: 'SELECT_ANSWER', answer })
    dispatch({ type: 'SHOW_RESULT' })
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < TOTAL_QUESTIONS - 1) {
      dispatch({ type: 'NEXT_QUESTION' })
    }
  }

  // Check if models are ready from AppContext
  if (!modelsReady) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="Memory Quiz" backPath="/" />
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-6 text-center")}> Loading AI model... </Text>
        </View>
      </SafeAreaView>
    )
  }

  // Show error state
  if (hasError) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="Memory Quiz" backPath="/" />
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-4 text-center")}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className={cn("bg-emerald-600 rounded-2xl px-6 py-3 mt-6")}
          >
            <Text className={cn("text-white text-base font-semibold")}> Go Back </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Show loading for first question
  if (!currentQuestion) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="Memory Quiz" backPath="/" />
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-6 text-center")}>Generating quiz questions...</Text>
          <Text className={cn("text-gray-600 text-base text-center mt-2")}>This will only take a moment</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <Header title="Memory Quiz" backPath="/" />

      <ScrollView
        className={cn("flex-1")}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View className={cn("px-4")}>
          {/* Quiz Image and Question Card with Overlap */}
          <View className={cn("mb-6")}>
            {/* Quiz Image */}
            <Image
              source={require("../assets/quiz.webp")}
              className={cn("rounded-2xl")}
              style={{ width: 160, height: 160, zIndex: 0 }}
              resizeMode="cover"
            />

            {/* Question Card - Overlapping from bottom */}
            <View
              className={cn("rounded-2xl p-5")}
              style={{
                backgroundColor: '#efe5faff',
                borderRightWidth: 5,
                borderBottomWidth: 5,
                borderRightColor: '#7947d1ff',
                borderBottomColor: '#7947d1ff',
                marginTop: -46,
                zIndex: 1,
              }}
            >
              <Text className={cn("text-gray-900 text-xl font-semibold leading-7 text-center")}> {currentQuestion.question} </Text>
            </View>
          </View>

          {/* Answer Options */}
          <View className={cn("flex-row gap-3 mb-6")}>
            {/* Option A */}
            <TouchableOpacity
              onPress={() => handleAnswerSelect("A")}
              disabled={showResult}
              className={cn("flex-1 bg-white rounded-2xl border-2 border-gray-500 p-5",
                selectedAnswer === "A" && showResult && isCorrect && "bg-emerald-50 border-emerald-600",
                selectedAnswer === "A" && showResult && !isCorrect && "bg-red-50 border-red-500"
              )}
            >
              <View className={cn("flex-row items-center justify-center mb-2")}>
                <View
                  className={cn("w-8 h-8 items-center justify-center mr-2")}
                  style={{
                    borderRadius: 16,
                    backgroundColor: selectedAnswer === "A" && showResult && isCorrect ? "#10B981" :
                      selectedAnswer === "A" && showResult && !isCorrect ? "#EF4444" : "#636f83ff"
                  }}
                >
                  <Text className={cn("text-white font-semibold")}>A</Text>
                </View>
                {selectedAnswer === "A" && showResult && (
                  <Ionicons
                    name={isCorrect ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={isCorrect ? "#10B981" : "#EF4444"}
                  />
                )}
              </View>
              <Text className={cn("text-gray-800 text-base text-center font-medium")}>{currentQuestion.optionA}</Text>
            </TouchableOpacity>

            {/* Option B */}
            <TouchableOpacity
              onPress={() => handleAnswerSelect("B")}
              disabled={showResult}
              className={cn("flex-1 bg-white rounded-2xl border-2 border-gray-500 p-5",
                selectedAnswer === "B" && showResult && isCorrect && "bg-emerald-50 border-emerald-600",
                selectedAnswer === "B" && showResult && !isCorrect && "bg-red-50 border-red-500"
              )}
            >
              <View className={cn("flex-row items-center justify-center mb-2")}>
                <View
                  className={cn("w-8 h-8 items-center justify-center mr-2")}
                  style={{
                    borderRadius: 16,
                    backgroundColor: selectedAnswer === "B" && showResult && isCorrect ? "#10B981" :
                      selectedAnswer === "B" && showResult && !isCorrect ? "#EF4444" : "#636f83ff"
                  }}
                >
                  <Text className={cn("text-white font-semibold")}>B</Text>
                </View>
                {selectedAnswer === "B" && showResult && (
                  <Ionicons
                    name={isCorrect ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={isCorrect ? "#10B981" : "#EF4444"}
                  />
                )}
              </View>
              <Text className={cn("text-gray-800 text-base text-center font-medium")}>{currentQuestion.optionB}</Text>
            </TouchableOpacity>
          </View>

          {/* Result Feedback */}
          {showResult && (
            <View className={cn("bg-white rounded-2xl shadow-sm border p-5 mb-4",
              isCorrect ? "border-2 border-emerald-600" : "border-2 border-red-500"
            )}>
              <View className={cn("flex-row items-center mb-3")}>
                <Ionicons
                  name={isCorrect ? "checkmark-circle" : "information-circle"}
                  size={28}
                  color={isCorrect ? "#10B981" : "#EF4444"}
                />
                <Text className={cn("text-lg font-semibold ml-2",
                  isCorrect ? "text-emerald-700" : "text-red-600"
                )}>
                  {isCorrect ? "Correct!" : "Not quite right"}
                </Text>
              </View>

              <Text className={cn("text-gray-700 text-base leading-6")}>
                <Text className={cn("font-semibold")}>The correct answer is: </Text>
                {currentQuestion.correctAnswer === "A" ? currentQuestion.optionA : currentQuestion.optionB}
              </Text>
            </View>
          )}

          {/* Next Question Button */}
          {showResult && currentQuestionIndex < TOTAL_QUESTIONS - 1 && (
            <View className={cn("items-center")}>
              <TouchableOpacity
                onPress={handleNextQuestion}
                className={cn("rounded-2xl py-3 px-8 shadow-sm")}
                style={{ backgroundColor: '#7947d1ff' }}
                accessibilityLabel="Next question"
              >
                <Text className={cn("text-white text-base font-semibold")}>Next Question</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quiz Complete */}
          {showResult && currentQuestionIndex === TOTAL_QUESTIONS - 1 && (
            <View className={cn("bg-emerald-50 rounded-2xl border border-emerald-600 p-6 items-center")}>
              <Ionicons name="trophy" size={48} color="#10B981" />
              <Text className={cn("text-gray-900 text-xl font-semibold mt-3 mb-2")}> Quiz Complete! </Text>
              <Text className={cn("text-gray-700 text-lg text-center mb-4")}> You got {score} out of {TOTAL_QUESTIONS} questions correct</Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className={cn("bg-emerald-600 rounded-2xl px-6 py-3")}
              >
                <Text className={cn("text-white text-base font-semibold")}> Back to Home </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Progress Indicator - Bottom */}
      <View className={cn("px-4 pb-4 bg-gray-50")}>
        <View className={cn("flex-row justify-between items-center mb-2")}>
          <Text className={cn("text-gray-700 text-base font-medium")}> Question {currentQuestionIndex + 1} of {TOTAL_QUESTIONS} </Text>
          <Text className={cn("text-emerald-600 text-base font-semibold")}> Score: {score}/{answeredQuestions} </Text>
        </View>

        {/* Progress Bar */}
        <View className={cn("bg-gray-200 rounded-full h-2")}>
          <View className={cn("bg-emerald-600 h-2 rounded-full")}
            style={{ width: `${((currentQuestionIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
