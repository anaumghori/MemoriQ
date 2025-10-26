import { useState, useRef } from "react"
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { Ionicons } from "@expo/vector-icons"
import { cn } from "../lib/utils"

interface CameraProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
}

export default function Camera({ images, onImagesChange, maxImages = 5 }: CameraProps) {
  const [isLoading, setIsLoading] = useState(false)

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required to take photos")
      return false
    }
    return true
  }

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library permission is required to select photos")
      return false
    }
    return true
  }

  const takePhoto = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add up to ${maxImages} images`)
      return
    }

    const hasPermission = await requestCameraPermission()
    if (!hasPermission) return

    setIsLoading(true)
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        onImagesChange([...images, result.assets[0].uri])
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo")
    } finally {
      setIsLoading(false)
    }
  }

  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit Reached", `You can only add up to ${maxImages} images`)
      return
    }

    const hasPermission = await requestMediaLibraryPermission()
    if (!hasPermission) return

    setIsLoading(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        onImagesChange([...images, result.assets[0].uri])
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image")
    } finally {
      setIsLoading(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }

  return (
    <View className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4")}>
      <Text className={cn("text-gray-700 text-lg font-medium mb-3")}> Add Photos </Text>
      <Text className={cn("text-gray-500 text-sm mb-3")}> Capture moments or add photos to your note </Text>
      
      {/* Action Buttons */}
      <View className={cn("flex-row gap-3 mb-4")}>
        <TouchableOpacity onPress={takePhoto} disabled={isLoading} className={cn("flex-1 flex-row items-center justify-center bg-blue-50 rounded-xl py-3 px-4", isLoading && "opacity-50")} accessibilityLabel="Take photo with camera" accessibilityRole="button">
          <Ionicons name="camera" size={20} color="#3b82f6" />
          <Text className={cn("text-blue-600 font-medium ml-2")}> Camera </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickImage} disabled={isLoading} className={cn("flex-1 flex-row items-center justify-center bg-purple-50 rounded-xl py-3 px-4", isLoading && "opacity-50")} accessibilityLabel="Choose from gallery" accessibilityRole="button">
          <Ionicons name="images" size={20} color="#9333ea" />
          <Text className={cn("text-purple-600 font-medium ml-2")}> Gallery </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View className={cn("items-center py-4")}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text className={cn("text-gray-500 text-sm mt-2")}> Processing... </Text>
        </View>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <View>
          <Text className={cn("text-gray-600 text-sm mb-2")}>Attached Photos ({images.length}/{maxImages})</Text>
          <View className={cn("flex-row flex-wrap gap-2")}>
            {images.map((uri, index) => (
              <View key={index} className={cn("relative")}>
                <Image source={{ uri }} className={cn("w-24 h-24 rounded-lg")} resizeMode="cover" />
                <TouchableOpacity onPress={() => removeImage(index)} className={cn("absolute top-1 right-1 bg-red-500 rounded-full p-1")} accessibilityLabel={`Remove photo ${index + 1}`} accessibilityRole="button">
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Helper Text */}
      {images.length === 0 && !isLoading && (
        <View className={cn("items-center py-4 border border-dashed border-gray-300 rounded-lg")}>
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
          <Text className={cn("text-gray-400 text-sm mt-2")}> No photos added yet </Text>
        </View>
      )}
    </View>
  )
}