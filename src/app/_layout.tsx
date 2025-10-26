import "../global.css";
import { Slot } from "expo-router";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../lib/utils";
import { AppProvider, useApp } from "../lib/appContext";

function AppGate() {
  const { dbReady, modelsReady, downloadProgress, error } = useApp()

  if (!dbReady || !modelsReady) {
    const progressPercentage = Math.round(downloadProgress)
    return (
      <SafeAreaView className={cn("flex-1 bg-emerald-700")}>
        <View className={cn("flex-1 items-center justify-center px-6")}>
          <View className={cn("w-full max-w-md rounded-2xl bg-white/90 p-6")}>
            <View className={cn("items-center mb-5")}>
              <View className={cn("h-12 w-12 rounded-full bg-emerald-100 items-center justify-center mb-3")}>
                <Ionicons name="leaf-outline" size={24} color="#059669" />
              </View>
              <Text className={cn("text-gray-900 text-xl font-semibold")}> MemoriQ </Text>
            </View>
            <Text className={cn("text-gray-800 text-2xl font-semibold mb-4 text-center")}> Loading model... </Text>
            <View className={cn("w-full mb-2")}>
              <View className={cn("w-full h-3 bg-gray-200 rounded-full overflow-hidden")}>
                <View className={cn("h-full bg-emerald-600 rounded-full")} style={{ width: `${progressPercentage}%` }} />
              </View>
              <Text className={cn("text-gray-700 text-center mt-3 font-medium")}> {progressPercentage}% </Text>
            </View>
            <View className={cn("w-full mt-4")}>
              <View className={cn("flex-row items-start gap-2")}>
                <Ionicons name="download-outline" size={18} color="#047857" />
                <Text className={cn("text-gray-600 text-base leading-relaxed flex-1")}>
                  This is a one-time setup. After this download, it won't be required again.
                </Text>
              </View>
              <View className={cn("flex-row items-start gap-2 mt-3")}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#047857" />
                <Text className={cn("text-gray-600 text-base leading-relaxed flex-1")}>
                  The model stays fully on-device. No user information or chats are ever stored on any servers.
                </Text>
              </View>
            </View>
            {error && (
              <View className={cn("mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg")}>
                <View className={cn("flex-row items-center justify-center gap-2")}>
                  <Ionicons name="alert-circle-outline" size={20} color="#b91c1c" />
                  <Text className={cn("text-red-700 text-base text-center")}>Error: {error}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return <Slot />
}

export default function Layout() {
  return (
    <AppProvider>
      <AppGate />
    </AppProvider>
  )
}
