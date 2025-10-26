import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, Alert } from "react-native"
import { useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, setAudioModeAsync, requestRecordingPermissionsAsync } from "expo-audio"
import { Ionicons } from "@expo/vector-icons"
import { cn } from "../lib/utils"

interface AudioProps {
  audioUri: string | null
  onAudioUriChange: (uri: string | null) => void
}

export default function Audio({ audioUri, onAudioUriChange }: AudioProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder)

  useEffect(() => {
    const setupAudio = async () => {
      try {
        const { granted } = await requestRecordingPermissionsAsync()
        if (!granted) {
          Alert.alert("Permission Required", "Audio recording permission is needed to record voice notes")
          return
        }
        setHasPermission(granted)
        
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          shouldPlayInBackground: false,
        })
      } catch (error) {
        // Audio setup failed
      }
    }
    
    setupAudio()
  }, [])

  const startRecording = async () => {
    if (!hasPermission) {
      const { granted } = await requestRecordingPermissionsAsync()
      if (!granted) {
        Alert.alert("Permission Denied", "Audio recording permission is required")
        return
      }
      setHasPermission(granted)
    }

    try {
      // If there's existing audio, ask for confirmation
      if (audioUri) {
        Alert.alert(
          "Replace Recording",
          "This will replace the existing audio recording. Continue?",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Replace", 
              style: "destructive",
              onPress: async () => {
                onAudioUriChange(null)
                await audioRecorder.prepareToRecordAsync()
                audioRecorder.record()
                setIsRecording(true)
                setIsPaused(false)
              }
            }
          ]
        )
      } else {
        await audioRecorder.prepareToRecordAsync()
        audioRecorder.record()
        setIsRecording(true)
        setIsPaused(false)
      }
    } catch (error) {
      Alert.alert("Error", "Failed to start recording")
    }
  }

  const pauseRecording = () => {
    audioRecorder.pause()
    setIsPaused(true)
  }

  const resumeRecording = () => {
    audioRecorder.record()
    setIsPaused(false)
  }

  const stopRecording = async () => {
    try {
      await audioRecorder.stop()
      const uri = audioRecorder.uri
      if (uri) {
        onAudioUriChange(uri)
      }
      setIsRecording(false)
      setIsPaused(false)
    } catch (error) {
      Alert.alert("Error", "Failed to stop recording")
    }
  }

  const deleteAudio = () => {
    Alert.alert(
      "Delete Recording",
      "Are you sure you want to delete this audio recording?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            onAudioUriChange(null)
          }
        }
      ]
    )
  }

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
      <Text className={cn("text-gray-700 text-lg font-medium mb-3")}> Voice Note </Text>
      <Text className={cn("text-gray-500 text-md mb-3")}> Record a voice message for your note </Text>

      {/* Recording Controls */}
      {!audioUri && !isRecording && (
        <TouchableOpacity onPress={startRecording} className={cn("flex-row items-center justify-center bg-red-50 rounded-xl py-4")} accessibilityLabel="Start recording" accessibilityRole="button">
          <Ionicons name="mic" size={24} color="#b93737ff" />
          <Text className={cn("text-red-800 font-medium ml-2")}> Start Recording </Text>
        </TouchableOpacity>
      )}

      {/* Active Recording UI */}
      {isRecording && (
        <View className={cn("bg-red-50 rounded-xl p-4")}>
          <View className={cn("flex-row items-center justify-between mb-3")}>
            <View className={cn("flex-row items-center")}>
              {!isPaused ? (
                <View className={cn("w-3 h-3 bg-red-800 rounded-full mr-2 animate-pulse")} />
              ) : (
                <View className={cn("w-3 h-3 bg-red-800 rounded-full mr-2")} />
              )}
              <Text className={cn("text-red-800 font-medium")}>{isPaused ? "Paused" : "Recording"}</Text>
            </View>
            <Text className={cn("text-red-800 font-mono")}>{formatTime(recorderState.durationMillis)}</Text>
          </View>

          <View className={cn("flex-row gap-2")}>
            {!isPaused ? (
              <TouchableOpacity onPress={pauseRecording} className={cn("flex-1 flex-row items-center justify-center bg-white rounded-lg py-2")} accessibilityLabel="Pause recording" accessibilityRole="button">
                <Ionicons name="pause" size={20} color="#b93737ff" />
                <Text className={cn("text-red-600 font-medium ml-2")}> Pause </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={resumeRecording} className={cn("flex-1 flex-row items-center justify-center bg-white rounded-lg py-2")} accessibilityLabel="Resume recording" accessibilityRole="button">
                <Ionicons name="play" size={20} color="#b93737ff" />
                <Text className={cn("text-red-600 font-medium ml-2")}> Resume </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity onPress={stopRecording} className={cn("flex-1 flex-row items-center justify-center bg-red-700 rounded-lg py-2")} accessibilityLabel="Stop recording" accessibilityRole="button">
              <Ionicons name="stop" size={20} color="white" />
              <Text className={cn("text-white font-medium ml-2")}> Stop </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Playback Controls */}
      {audioUri && !isRecording && (
        <AudioPlayback 
          audioUri={audioUri} 
          onReRecord={startRecording}
          onDelete={deleteAudio}
        />
      )}

      {/* Empty State */}
      {!audioUri && !isRecording && (
        <View className={cn("items-center py-4 border border-dashed border-gray-400 rounded-lg mt-3")}>
          <Ionicons name="mic-outline" size={32} color="#838a94ff" />
          <Text className={cn("text-gray-600 text-sm mt-2")}> No voice note added yet </Text>
        </View>
      )}
    </View>
  )
}

// Separate component for audio playback to isolate the audio player hooks
function AudioPlayback({ 
  audioUri, 
  onReRecord, 
  onDelete 
}: { 
  audioUri: string
  onReRecord: () => void
  onDelete: () => void
}) {
  const audioPlayer = useAudioPlayer(audioUri)
  const playerStatus = useAudioPlayerStatus(audioPlayer)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    return () => {
      try {
        if (audioPlayer && isPlaying) {
          audioPlayer.pause()
        }
      } catch (error) {
        // Player already released
      }
    }
  }, [audioPlayer, isPlaying])

  // Mirror status into React state to avoid reading shared values during render
  useEffect(() => {
    if (!playerStatus) return
    setIsPlaying(!!playerStatus.playing)
    setCurrentTime(playerStatus.currentTime)
    setDuration(playerStatus.duration)
  }, [playerStatus])

  const formatPlayerTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const playAudio = () => {
    try {
      audioPlayer.play()
    } catch (error) {
      // Error playing audio
    }
  }

  const pauseAudio = () => {
    try {
      audioPlayer.pause()
    } catch (error) {
      // Error pausing audio
    }
  }

  if (!playerStatus) return null

  return (
    <View className={cn("bg-emerald-50 rounded-xl p-4")}>
      <View className={cn("flex-row items-center justify-between mb-3")}> 
        <Text className={cn("text-emerald-800 font-medium")}> Audio Recorded </Text>
        <Text className={cn("text-emerald-800 font-mono")}>
          {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
        </Text>
      </View>

      <View className={cn("flex-row gap-2")}> 
        {!isPlaying ? (
          <TouchableOpacity onPress={playAudio} className={cn("flex-1 flex-row items-center justify-center bg-white rounded-lg py-2")} accessibilityLabel="Play audio" accessibilityRole="button">
            <Ionicons name="play" size={20} color="#177c5bff" />
            <Text className={cn("text-emerald-800 font-medium ml-2")}> Play </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={pauseAudio} className={cn("flex-1 flex-row items-center justify-center bg-white rounded-lg py-2")} accessibilityLabel="Pause audio" accessibilityRole="button">
            <Ionicons name="pause" size={20} color="#177c5bff" />
            <Text className={cn("text-emerald-800 font-medium ml-2")}> Pause </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onReRecord} className={cn("flex-1 flex-row items-center justify-center bg-white rounded-lg py-2")} accessibilityLabel="Re-record" accessibilityRole="button">
          <Ionicons name="refresh" size={20} color="#d89014ff" />
          <Text className={cn("text-amber-600 font-medium ml-2")}> Re-record </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDelete} className={cn("px-3 bg-white rounded-lg py-2")} accessibilityLabel="Delete recording" accessibilityRole="button">
          <Ionicons name="trash-outline" size={20} color="#ce3d3dff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}
