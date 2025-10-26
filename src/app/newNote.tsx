import { useReducer, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Alert, ActivityIndicator, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useLocalSearchParams } from "expo-router"
import Header from "../components/Header"
import Camera from "../components/Camera"
import Audio from "../components/Audio"
import { cn } from "../lib/utils"
import { createNote, updateNote, getNoteById } from "../database/notesOperations"

// Predefined tags hoisted outside component to avoid re-creation
const AVAILABLE_TAGS = ["Family", "Friends", "Places", "Events", "People", "Childhood", "Travel", "Moments"]

interface FormState {
  title: string
  content: string
  selectedTags: string[]
  images: Array<{ uri: string; description: string }>
  audioUri: string | null
  loading: boolean
  initialLoading: boolean
  isEditMode: boolean
  noteId: number | null
}

type FormAction =
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_CONTENT'; value: string }
  | { type: 'TOGGLE_TAG'; tag: string }
  | { type: 'SET_IMAGES'; images: Array<{ uri: string; description: string }> }
  | { type: 'UPDATE_IMAGE_DESCRIPTION'; index: number; description: string }
  | { type: 'SET_AUDIO_URI'; uri: string | null }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_INITIAL_LOADING'; value: boolean }
  | { type: 'LOAD_NOTE_SUCCESS'; payload: {
      title: string
      content: string
      tags: string[]
      images: Array<{ uri: string; description: string }>
      audioUri: string | null
      noteId: number
    }}

const initialFormState: FormState = {
  title: '',
  content: '',
  selectedTags: [],
  images: [],
  audioUri: null,
  loading: false,
  initialLoading: false,
  isEditMode: false,
  noteId: null,
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...state, title: action.value }
    case 'SET_CONTENT':
      return { ...state, content: action.value }
    case 'TOGGLE_TAG':
      return {
        ...state,
        selectedTags: state.selectedTags.includes(action.tag)
          ? state.selectedTags.filter(t => t !== action.tag)
          : [...state.selectedTags, action.tag]
      }
    case 'SET_IMAGES':
      return { ...state, images: action.images }
    case 'UPDATE_IMAGE_DESCRIPTION':
      return {
        ...state,
        images: state.images.map((img, idx) =>
          idx === action.index ? { ...img, description: action.description } : img
        )
      }
    case 'SET_AUDIO_URI':
      return { ...state, audioUri: action.uri }
    case 'SET_LOADING':
      return { ...state, loading: action.value }
    case 'SET_INITIAL_LOADING':
      return { ...state, initialLoading: action.value }
    case 'LOAD_NOTE_SUCCESS':
      return {
        ...state,
        title: action.payload.title,
        content: action.payload.content,
        selectedTags: action.payload.tags,
        images: action.payload.images,
        audioUri: action.payload.audioUri,
        isEditMode: true,
        noteId: action.payload.noteId,
        initialLoading: false,
      }
    default:
      return state
  }
}

export default function NewNote() {
  const [state, dispatch] = useReducer(formReducer, initialFormState)
  const { title, content, selectedTags, images, audioUri, loading, initialLoading, isEditMode, noteId } = state
  const router = useRouter()
  const params = useLocalSearchParams()

  // Load existing note if editing
  useEffect(() => {
    async function loadNote() {
      const id = params.id as string
      if (id) {
        dispatch({ type: 'SET_INITIAL_LOADING', value: true })

        try {
          const note = await getNoteById(parseInt(id))
          if (note) {
            dispatch({
              type: 'LOAD_NOTE_SUCCESS',
              payload: {
                title: note.title,
                content: note.content,
                tags: note.tags.map(tag => tag.name),
                images: note.images.map(img => ({ uri: img.uri, description: img.description || '' })),
                audioUri: note.audioUri,
                noteId: parseInt(id),
              }
            })
          } else {
            Alert.alert('Error', 'Note not found')
            router.back()
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to load note')
          router.back()
        }
      }
    }
    loadNote()
  }, [params.id])

  const toggleTag = (tag: string) => {
    dispatch({ type: 'TOGGLE_TAG', tag })
  }

  // Adapter function to handle Camera component's string[] output
  const handleImagesChange = (newUris: string[]) => {
    const updatedImages = newUris.map(uri => {
      const existing = images.find(img => img.uri === uri)
      return existing || { uri, description: '' }
    })
    dispatch({ type: 'SET_IMAGES', images: updatedImages })
  }

  const updateImageDescription = (index: number, description: string) => {
    dispatch({ type: 'UPDATE_IMAGE_DESCRIPTION', index, description })
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title')
      return
    }

    dispatch({ type: 'SET_LOADING', value: true })

    try {
      if (isEditMode && noteId) {
        // Update existing note
        await updateNote({
          id: noteId,
          title: title.trim(),
          content: content.trim(),
          tags: selectedTags,
          images,
          audioUri,
        })
      } else {
        // Create new note
        await createNote({
          title: title.trim(),
          content: content.trim(),
          tags: selectedTags,
          images,
          audioUri,
        })
      }

      router.back()
    } catch (error) {
      Alert.alert('Error', 'Failed to save note')
    } finally {
      dispatch({ type: 'SET_LOADING', value: false })
    }
  }

  if (initialLoading) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title={isEditMode ? "Edit Note" : "New Note"} backPath="/notes" />
        <View className={cn("flex-1 items-center justify-center")}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <Header title={isEditMode ? "Edit Note" : "New Note"} backPath="/notes" />

      <KeyboardAvoidingView
        behavior="height"
        className={cn("flex-1")}
      >
        <ScrollView
          className={cn("flex-1")}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className={cn("px-4 py-4")}>
            {/* Title Input Card */}
            <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
              <Text className={cn("text-gray-700 text-lg font-medium")}> Note Title </Text>
              <TextInput
                value={title}
                onChangeText={(value) => dispatch({ type: 'SET_TITLE', value })}
                placeholder="Give your note a title..."
                placeholderTextColor="#8a919cff"
                className={cn("text-gray-900 text-lg", "border-b border-gray-200", "pb-2")}
                accessibilityLabel="Note title input"
                multiline={false}
                maxLength={50}
              />
              <Text className={cn("text-gray-400 text-sm mt-2 text-right")}> {title.length}/50 </Text>
            </View>

            {/* Content Input Card */}
            <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
              <Text className={cn("text-gray-700 text-lg font-medium")}> Note Content </Text>
              <TextInput
                value={content}
                onChangeText={(value) => dispatch({ type: 'SET_CONTENT', value })}
                placeholder="Write your thoughts here..."
                placeholderTextColor="#9ca3af"
                className={cn("text-gray-900 text-lg leading-6", "min-h-[200px]")}
                accessibilityLabel="Note content input"
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Camera Component */}
            <Camera images={images.map(img => img.uri)} onImagesChange={handleImagesChange} maxImages={5} />

            {/* Image Descriptions (Optional) */}
            {images.length > 0 && (
              <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
                <Text className={cn("text-gray-700 text-lg font-medium mb-2")}> Describe Your Photos (Optional) </Text>
                <Text className={cn("text-gray-500 text-sm mb-3")}> Adding descriptions helps you find these photos later </Text>

                {images.map((image, index) => (
                  <View key={index} className={cn("mb-4")}>
                    <View className={cn("flex-row items-center mb-2")}>
                      <Image
                        source={{ uri: image.uri }}
                        className={cn("w-16 h-16 rounded-lg")}
                        resizeMode="cover"
                      />
                      <Text className={cn("text-gray-600 text-sm ml-3 font-medium")}> Photo {index + 1} </Text>
                    </View>

                    <TextInput
                      value={image.description}
                      onChangeText={(text) => updateImageDescription(index, text)}
                      placeholder="Describe what's in this photo..."
                      placeholderTextColor="#9ca3af"
                      className={cn("bg-gray-50 rounded-lg px-3 py-2 text-gray-900 text-sm border border-gray-200")}
                      multiline
                      maxLength={200}
                    />
                    <Text className={cn("text-gray-400 text-xs mt-1 text-right")}> {image.description.length}/200 </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Audio Component */}
            <Audio audioUri={audioUri} onAudioUriChange={(uri) => dispatch({ type: 'SET_AUDIO_URI', uri })} />

            {/* Tags Selection Card */}
            <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6")}>
              <Text className={cn("text-gray-700 text-md font-medium mb-3")}> Add Tags (Optional) </Text>
              <Text className={cn("text-gray-500 text-sm mb-3")}> Tags help you organize and find your notes easily </Text>
              <View className={cn("flex-row flex-wrap gap-2")}>
                {AVAILABLE_TAGS.map((tag) => {const isSelected = selectedTags.includes(tag)
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      className={cn("px-3 py-2 rounded-full border", isSelected ? "bg-emerald-50 border-emerald-600" : "bg-white border-gray-300")}
                      accessibilityLabel={`Tag: ${tag}`}
                      accessibilityHint={`Tap to ${isSelected ? 'remove' : 'add'} this tag`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text className={cn("text-sm font-medium", isSelected ? "text-emerald-700" : "text-gray-600")}> {tag} </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Action Buttons */}
            <View className={cn("flex-row gap-3")}>
              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => router.back()}
                className={cn("flex-1 bg-gray-200 rounded-2xl py-4 items-center")}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                disabled={loading}
              >
                <Text className={cn("text-gray-700 text-base font-semibold")}> Cancel </Text>
              </TouchableOpacity>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                className={cn("flex-1 bg-emerald-600 rounded-2xl py-4 items-center shadow-sm")}
                accessibilityLabel="Save note"
                accessibilityRole="button"
                disabled={!title.trim() || loading}
                style={{opacity: title.trim() && !loading ? 1 : 0.5}}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className={cn("text-white text-base font-semibold")}> Save Note </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}