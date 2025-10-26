import { useState, useEffect } from "react"
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import Header from "../components/Header"
import { Ionicons, Feather } from "@expo/vector-icons"
import Entypo from "@expo/vector-icons/Entypo"
import { cn } from "../lib/utils"
import { getNoteById } from "../database/notesOperations"
import { NoteWithDetails } from "../database/types"
import NoteActionsMenu from "../components/NoteActionsMenu"

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

export default function ViewNote() {
  const [note, setNote] = useState<NoteWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [showActionsMenu, setShowActionsMenu] = useState(false)
  
  const router = useRouter()
  const params = useLocalSearchParams()
  const noteId = params.id as string

  // Load note data
  useEffect(() => {
    async function loadNote() {
      if (!noteId) {
        Alert.alert("Error", "Note ID not provided")
        router.back()
        return
      }

      setLoading(true)
      try {
        const loadedNote = await getNoteById(parseInt(noteId))
        if (loadedNote) {
          setNote(loadedNote)
        } else {
          Alert.alert("Error", "Note not found")
          router.back()
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load note")
        router.back()
      } finally {
        setLoading(false)
      }
    }

    loadNote()
  }, [noteId])

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const month = date.toLocaleString("en-US", { month: "short" })
    const day = date.getDate()
    const year = date.getFullYear()
    const time = date.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    return `${month} ${day}, ${year} • ${time}`
  }

  const formatAudioTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="View Note" backPath="/notes" />
        <View className={cn("flex-1 items-center justify-center")}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    )
  }

  if (!note) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="View Note" backPath="/notes" />
        <View className={cn("flex-1 items-center justify-center")}>
          <Text className={cn("text-gray-500 text-lg")}> Note not found </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <Header title="View Note" backPath="/notes" />
      
      <ScrollView className={cn("flex-1")} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View className={cn("px-4 py-4")}>
          {/* Note Header Card with Actions Menu */}
          <View className={cn("relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
            <Text className={cn("text-gray-500 text-sm mb-2")}> {formatTimestamp(note.createdAt)} </Text>
            <Text className={cn("text-gray-900 font-bold text-2xl mb-3")}> {note.title} </Text>
            
            {/* Three dots menu button in top right corner */}
            <TouchableOpacity
              onPress={() => setShowActionsMenu(!showActionsMenu)}
              accessibilityLabel="More options"
              accessibilityRole="button"
              className={cn("absolute top-4 right-4 p-2")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Entypo name="dots-three-vertical" size={20} color="#8b919cff" />
            </TouchableOpacity>

            {/* NoteActionsMenu component */}
            <NoteActionsMenu
              noteId={noteId}
              isVisible={showActionsMenu}
              onClose={() => setShowActionsMenu(false)}
            />
            
            {/* Tags */}
            {note.tags.length > 0 && (
              <View className={cn("flex-row flex-wrap gap-2 mt-2")}>
                {note.tags.map((tag) => (
                  <View key={tag.id} className={cn("px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-600")}>
                    <Text className={cn("text-emerald-700 text-sm font-medium")}> {tag.name} </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Content Card */}
          {note.content && (
            <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
              <Text className={cn("text-gray-700 text-lg font-medium mb-3")}> Content </Text>
              <Text className={cn("text-gray-800 text-base leading-7")}>{note.content}</Text>
            </View>
          )}

          {/* Images Section */}
          {note.images.length > 0 && (
            <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
              <Text className={cn("text-gray-700 text-lg font-medium mb-3")}> Photos ({note.images.length})</Text>
              <View className={cn("flex-row flex-wrap gap-2")}>
                {note.images.map((image, index) => (
                  <TouchableOpacity key={image.id} onPress={() => setSelectedImageIndex(index)} activeOpacity={0.9}>
                    <Image source={{ uri: image.uri }} className={cn("w-28 h-28 rounded-lg")} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Audio Player - Only render if audio exists */}
          {note.audioUri && (
            <AudioPlayerComponent audioUri={note.audioUri} />
          )}
        </View>
      </ScrollView>

      {/* Full Screen Image Viewer Modal */}
      <Modal
        visible={selectedImageIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImageIndex(null)}
      >
        <View className={cn("flex-1 bg-black")}>
          <SafeAreaView className={cn("flex-1")}>
            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setSelectedImageIndex(null)}
              className={cn("absolute top-4 right-4 z-10 bg-black/50 rounded-full p-2")}
              accessibilityLabel="Close image viewer"
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>

            {/* Image Display */}
            {selectedImageIndex !== null && note.images[selectedImageIndex] && (
              <View className={cn("flex-1 justify-center items-center")}>
                <Image
                  source={{ uri: note.images[selectedImageIndex].uri }}
                  style={{ width: screenWidth, height: screenHeight * 0.8 }}
                  resizeMode="contain"
                />
                
                {/* Image Counter */}
                <View className={cn("absolute bottom-8 bg-black/50 px-4 py-2 rounded-full")}>
                  <Text className={cn("text-white text-base font-medium")}>
                    {selectedImageIndex + 1} / {note.images.length}
                  </Text>
                </View>

                {/* Navigation Arrows */}
                {note.images.length > 1 && (
                  <>
                    {selectedImageIndex > 0 && (
                      <TouchableOpacity
                        onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
                        className={cn("absolute left-4 bg-black/50 rounded-full p-2")}
                        accessibilityLabel="Previous image"
                      >
                        <Ionicons name="chevron-back" size={30} color="white" />
                      </TouchableOpacity>
                    )}
                    
                    {selectedImageIndex < note.images.length - 1 && (
                      <TouchableOpacity
                        onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
                        className={cn("absolute right-4 bg-black/50 rounded-full p-2")}
                        accessibilityLabel="Next image"
                      >
                        <Ionicons name="chevron-forward" size={30} color="white" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// Separate component for audio player to isolate hooks
function AudioPlayerComponent({ audioUri }: { audioUri: string }) {
  const audioPlayer = useAudioPlayer(audioUri)
  const audioStatus = useAudioPlayerStatus(audioPlayer)

  useEffect(() => {
    return () => {
      try {
        if (audioPlayer && audioStatus?.playing) {
          audioPlayer.pause()
        }
      } catch (error) {
        // Player already released
      }
    }
  }, [audioPlayer, audioStatus?.playing])

  const formatAudioTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const handlePlayPause = () => {
    if (!audioPlayer) return
    
    try {
      if (audioStatus?.playing) {
        audioPlayer.pause()
      } else {
        audioPlayer.play()
      }
    } catch (error) {
      // Error controlling playback
    }
  }

  const handleSeekBackward = () => {
    if (!audioPlayer || !audioStatus) return
    try {
      const newTime = Math.max(0, audioStatus.currentTime - 10)
      audioPlayer.seekTo(newTime)
    } catch (error) {
      // Error seeking backward
    }
  }

  const handleSeekForward = () => {
    if (!audioPlayer || !audioStatus) return
    try {
      const newTime = Math.min(audioStatus.duration, audioStatus.currentTime + 10)
      audioPlayer.seekTo(newTime)
    } catch (error) {
      // Error seeking forward
    }
  }

  if (!audioStatus) return null

  return (
    <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
      <Text className={cn("text-gray-700 text-lg font-medium mb-3")}> Voice Note </Text>
      
      <View className={cn("bg-emerald-50 rounded-xl p-4")}>
        {/* Time Display */}
        <View className={cn("flex-row justify-between items-center mb-4")}>
          <Text className={cn("text-emerald-800 font-mono text-base")}>
            {formatAudioTime(audioStatus.currentTime)}
          </Text>
          <Text className={cn("text-emerald-800 font-mono text-base")}>
            {formatAudioTime(audioStatus.duration)}
          </Text>
        </View>

        {/* Progress Bar */}
        <View className={cn("bg-emerald-200 rounded-full h-2 mb-4")}>
          <View 
            className={cn("bg-emerald-600 h-2 rounded-full")}
            style={{ width: `${(audioStatus.currentTime / audioStatus.duration) * 100 || 0}%` }}
          />
        </View>

        {/* Control Buttons */}
        <View className={cn("flex-row justify-center items-center gap-4")}>
          <TouchableOpacity onPress={handleSeekBackward} className={cn("p-2")} accessibilityLabel="Rewind 10 seconds">
            <Ionicons name="play-back" size={24} color="#177c5b" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handlePlayPause} 
            className={cn("bg-emerald-600 rounded-full p-4")}
            accessibilityLabel={audioStatus.playing ? "Pause" : "Play"}
          >
            <Ionicons name={audioStatus.playing ? "pause" : "play"} size={24} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSeekForward} className={cn("p-2")} accessibilityLabel="Forward 10 seconds">
            <Ionicons name="play-forward" size={24} color="#177c5b" />
          </TouchableOpacity>
        </View>

        {/* Status Text */}
        <Text className={cn("text-center text-emerald-700 text-sm mt-3")}>
          {audioStatus.playing ? "Playing" : audioStatus.currentTime > 0 ? "Paused" : "Ready to play"}
        </Text>
      </View>
    </View>
  )
}