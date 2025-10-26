import { useReducer, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, ScrollView, Image, Animated, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import * as Speech from "expo-speech"
import { cn } from "../lib/utils"
import { selectReminisceNotes, markNotesAsShown } from "../lib/selectReminisceNotes"
import { type NoteWithDetails } from "../database/types"

interface ReminisceState {
  notes: NoteWithDetails[]
  currentIndex: number
  isPlaying: boolean
  isPaused: boolean
  sessionComplete: boolean
  isLoading: boolean
  hasError: boolean
  errorMessage: string
}

type ReminisceAction =
  | { type: 'INIT_SUCCESS'; notes: NoteWithDetails[] }
  | { type: 'INIT_ERROR'; message: string }
  | { type: 'NEXT_NOTE'; totalNotes: number }
  | { type: 'PREV_NOTE' }
  | { type: 'SET_PLAYING'; value: boolean }
  | { type: 'SET_PAUSED'; value: boolean }
  | { type: 'COMPLETE_SESSION' }

const initialReminisceState: ReminisceState = {
  notes: [],
  currentIndex: 0,
  isPlaying: false,
  isPaused: false,
  sessionComplete: false,
  isLoading: true,
  hasError: false,
  errorMessage: '',
}

function reminisceReducer(state: ReminisceState, action: ReminisceAction): ReminisceState {
  switch (action.type) {
    case 'INIT_SUCCESS':
      return {
        ...state,
        notes: action.notes,
        isLoading: false,
      }
    case 'INIT_ERROR':
      return {
        ...state,
        hasError: true,
        errorMessage: action.message,
        isLoading: false,
      }
    case 'NEXT_NOTE':
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= action.totalNotes) {
        return {
          ...state,
          sessionComplete: true,
          isPlaying: false,
          isPaused: false,
        }
      }
      return {
        ...state,
        currentIndex: nextIndex,
        isPlaying: false,
        isPaused: false,
      }
    case 'PREV_NOTE':
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
        isPlaying: false,
        isPaused: false,
      }
    case 'SET_PLAYING':
      return {
        ...state,
        isPlaying: action.value,
      }
    case 'SET_PAUSED':
      return {
        ...state,
        isPaused: action.value,
      }
    case 'COMPLETE_SESSION':
      return {
        ...state,
        sessionComplete: true,
        isPlaying: false,
      }
    default:
      return state
  }
}

export default function ReminiscePage() {
  const [state, dispatch] = useReducer(reminisceReducer, initialReminisceState)
  const { notes, currentIndex, isPlaying, isPaused, sessionComplete, isLoading, hasError, errorMessage } = state
  const router = useRouter()

  const currentNote = notes[currentIndex]
  const totalNotes = notes.length
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Animation for speaking icon pulse effect
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Load notes on mount
  useEffect(() => {
    async function loadNotes() {
      try {
        const selectedNotes = await selectReminisceNotes(5)

        if (selectedNotes.length === 0) {
          dispatch({
            type: 'INIT_ERROR',
            message: 'No notes available. Please create some notes first.'
          })
          return
        }

        // Filter out notes without recall scripts
        const notesWithScripts = selectedNotes.filter(note => note.recallScript)

        if (notesWithScripts.length === 0) {
          dispatch({
            type: 'INIT_ERROR',
            message: 'No recall scripts available. Please wait for scripts to be generated.'
          })
          return
        }

        dispatch({ type: 'INIT_SUCCESS', notes: notesWithScripts })
      } catch (error) {
        dispatch({
          type: 'INIT_ERROR',
          message: 'Failed to load notes for reminisce session.'
        })
      }
    }

    loadNotes()

    // Cleanup: stop speech when unmounting
    return () => {
      Speech.stop()
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
      }
    }
  }, [])

  // Auto-play speech when note changes
  useEffect(() => {
    if (!currentNote || !currentNote.recallScript) return

    // Small delay to let UI settle
    const playTimer = setTimeout(() => {
      playSpeech()
    }, 300)

    return () => {
      clearTimeout(playTimer)
    }
  }, [currentIndex, notes])

  // Pulse animation effect
  useEffect(() => {
    if (isPlaying && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [isPlaying, isPaused])

  const playSpeech = () => {
    if (!currentNote?.recallScript) return

    dispatch({ type: 'SET_PLAYING', value: true })
    dispatch({ type: 'SET_PAUSED', value: false })

    Speech.speak(currentNote.recallScript, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0,
      onStart: () => {
        dispatch({ type: 'SET_PLAYING', value: true })
      },
      onDone: () => {
        dispatch({ type: 'SET_PLAYING', value: false })

        // Auto-advance to next note after 2 seconds
        autoAdvanceTimerRef.current = setTimeout(() => {
          dispatch({ type: 'NEXT_NOTE', totalNotes })
        }, 2000)
      },
      onError: () => {
        dispatch({ type: 'SET_PLAYING', value: false })
      },
    })
  }

  const handleTogglePause = () => {
    if (isPlaying) {
      Speech.stop()
      dispatch({ type: 'SET_PLAYING', value: false })
      dispatch({ type: 'SET_PAUSED', value: true })
    } else if (isPaused) {
      playSpeech()
    }
  }

  const handleReplay = () => {
    // Clear any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    Speech.stop()
    dispatch({ type: 'SET_PLAYING', value: false })
    dispatch({ type: 'SET_PAUSED', value: false })

    // Small delay before replaying
    setTimeout(() => {
      playSpeech()
    }, 100)
  }

  const handleNext = () => {
    // Clear any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    Speech.stop()

    if (currentIndex < totalNotes - 1) {
      dispatch({ type: 'NEXT_NOTE', totalNotes })
    } else {
      dispatch({ type: 'COMPLETE_SESSION' })
    }
  }

  const handlePrevious = () => {
    // Clear any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }

    Speech.stop()

    if (currentIndex > 0) {
      dispatch({ type: 'PREV_NOTE' })
    }
  }

  const handleEndSession = async () => {
    // Stop speech
    Speech.stop()

    // Clear any pending auto-advance
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
    }

    // Mark notes as shown
    const noteIds = notes.map(note => note.id)
    await markNotesAsShown(noteIds)

    router.back()
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <ActivityIndicator size="large" color="#7947d1ff" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-6 text-center")}>Loading...</Text>
          <Text className={cn("text-gray-600 text-base text-center mt-2")}>Selecting your memories</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Error state
  if (hasError) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <Ionicons name="alert-circle" size={80} color="#EF4444" />
          <Text className={cn("text-gray-900 text-xl font-semibold mt-6 text-center")}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className={cn("rounded-2xl px-8 py-4 mt-6 shadow-sm")}
            style={{ backgroundColor: '#7947d1ff' }}
          >
            <Text className={cn("text-white text-lg font-semibold")}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Session complete screen
  if (sessionComplete) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <Ionicons name="heart-circle" size={80} color="#7947d1ff" />
          <Text className={cn("text-gray-900 text-2xl font-semibold mt-6 text-center")}>Session Complete</Text>
          <Text className={cn("text-gray-600 text-lg text-center mt-3 mb-8")}>
            You've revisited {totalNotes} beautiful memories today
          </Text>
          <TouchableOpacity
            onPress={handleEndSession}
            className={cn("rounded-2xl px-8 py-4 shadow-sm")}
            style={{ backgroundColor: '#7947d1ff' }}
          >
            <Text className={cn("text-white text-lg font-semibold")}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Main reminisce session UI
  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <ScrollView
        className={cn("flex-1")}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className={cn("px-5")}>
          {/* Image or Speaking Icon */}
          <View className={cn("items-center justify-center mb-4")}>
            {currentNote.images.length > 0 ? (
              // 3D Image with offset border effect
              <View>
                <Image
                  source={{ uri: currentNote.images[0].uri }}
                  className={cn("rounded-2xl")}
                  style={{ width: 320, height: 200 }}
                  resizeMode="cover"
                />
              </View>
            ) : (
              // Fallback: Animated Speaking Icon (no 3D effect)
              <Animated.View
                className={cn("items-center justify-center rounded-full")}
                style={{
                  width: 120,
                  height: 120,
                  backgroundColor: '#14a373ff',
                  transform: [{ scale: isPlaying && !isPaused ? pulseAnim : 1 }],
                }}
              >
                <Ionicons
                  name={isPlaying && !isPaused ? "volume-high" : "mic"}
                  size={60}
                  color="white"
                />
              </Animated.View>
            )}
          </View>

          {/* Note Title */}
          <View className={cn("mb-3")}>
            <Text className={cn("text-gray-900 text-2xl font-bold text-center leading-8")}> {currentNote.title} </Text>
          </View>

          {/* Recall Script Card */}
          <View
            className={cn("rounded-2xl p-4 mb-4")}
            style={{
              backgroundColor: '#ffffffff',
              borderRightWidth: 5,
              borderBottomWidth: 5,
              borderRightColor: '#7947d1ff',
              borderBottomColor: '#7947d1ff',
            }}
          >
            <Text className={cn("text-gray-800 text-base leading-6 text-center")}>{currentNote.recallScript}</Text>
          </View>

          {/* Playback Controls */}
          <View className={cn("flex-row justify-center gap-3 mb-5")}>
            <TouchableOpacity
              onPress={handleTogglePause}
              className={cn("rounded-xl px-4 py-2.5 flex-row items-center gap-2")}
              style={{ backgroundColor: '#14a373ff' }}
            >
              <Ionicons
                name={isPaused ? "play" : "pause"}
                size={20}
                color="white"
              />
              <Text className={cn("text-base font-semibold text-white")}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReplay}
              className={cn("rounded-xl px-4 py-2.5 flex-row items-center gap-2")}
              style={{ backgroundColor: '#14a373ff' }}
            >
              <Ionicons name="reload" size={20} color="white" />
              <Text className={cn("text-base font-semibold text-white")}>Replay</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation */}
          <View className={cn("flex-row items-center justify-between px-2 mb-4")}>
            <TouchableOpacity
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              className={cn("rounded-full p-3")}
              style={{backgroundColor: currentIndex === 0 ? '#ccd3e0ff' : '#7947d1ff', opacity: currentIndex === 0 ? 0.5 : 1,}}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={currentIndex === 0 ? '#9CA3AF' : 'white'}
              />
            </TouchableOpacity>

            <View className={cn("items-center")}>
              <Text className={cn("text-gray-800 text-base font-semibold")}>Memory {currentIndex + 1} of {totalNotes}</Text>
            </View>

            <TouchableOpacity
              onPress={handleNext}
              disabled={currentIndex === totalNotes - 1}
              className={cn("rounded-full p-3")}
              style={{
                backgroundColor: currentIndex === totalNotes - 1 ? '#b5b7bbff' : '#7947d1ff',
                opacity: currentIndex === totalNotes - 1 ? 0.5 : 1,
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                color={currentIndex === totalNotes - 1 ? '#9CA3AF' : 'white'}
              />
            </TouchableOpacity>
          </View>

          {/* End Session Button */}
          <TouchableOpacity
            onPress={handleEndSession}
            className={cn("rounded-xl py-2.5 border-2")}
            style={{ borderColor: '#097718ff' }}
          >
            <Text className={cn("text-center font-semibold text-base")} style={{ color: '#097718ff' }}>End Session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
