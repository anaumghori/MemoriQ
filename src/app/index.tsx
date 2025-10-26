import { View, Text, TouchableOpacity, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { getAllNotes } from "../database/notesOperations"
import { cn } from "../lib/utils"

export default function MainPage() {
  const router = useRouter()

  const handleNavigateToNotes = () => {
    try {
      void getAllNotes()
    } catch {}
    router.push("/notes")
  }

  const handleNavigateToChat = () => {
    router.push("/chat")
  }

  const handleNavigateToQuiz = () => {
    router.push("/quiz")
  }

  const handleNavigateToReminisce = () => {
    router.push("/reminisce")
  }

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      {/* Hero Image with Fade Effect */}
      <View style={{ width: '100%', height: 220, position: 'relative', overflow: 'hidden' }}>
        <Image
          source={require("../assets/main_page.webp")}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Gradient overlay for fade effect */}
        <LinearGradient
          colors={["transparent", "rgba(249, 250, 251, 0.3)", "#f9fafb"]}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
        />
      </View>

      {/* Card Grid - 2x2 */}
      <View className={cn("flex-1 px-4 pb-4")} style={{ paddingTop: 20 }}>
        {/* First Row */}
        <View className={cn("flex-row justify-between mb-4")} style={{ height: '38%' }}>
          {/* Notes Card */}
          <TouchableOpacity
            onPress={handleNavigateToNotes}
            activeOpacity={0.8}
            className={cn("flex-1 mr-2")}
          >
            <View
              className={cn("bg-white overflow-hidden h-full")}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 30,
                borderBottomRightRadius: 30,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View className={cn("flex-1 items-center justify-center pt-4")}>
                <View>
                  <Ionicons name="book-outline" size={52} color="#e45858ff" />
                </View>
                <Text className={cn("text-sm font-bold text-gray-800 text-center mt-2")}>NOTES</Text>
              </View>
              <View
                className={cn("px-3 py-2.5 items-center")}
                style={{ backgroundColor: '#e45858ff' }}
              >
                <Text className={cn("text-white text-xs font-semibold")}>Write detailed notes about your memories</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Chat Card */}
          <TouchableOpacity
            onPress={handleNavigateToChat}
            activeOpacity={0.8}
            className={cn("flex-1 ml-2")}
          >
            <View
              className={cn("bg-white overflow-hidden h-full")}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 30,
                borderBottomRightRadius: 30,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View className={cn("flex-1 items-center justify-center pt-4")}>
                <View>
                  <Ionicons name="chatbubbles-outline" size={52} color="#55ac8cff" />
                </View>
                <Text className={cn("text-sm font-bold text-gray-800 text-center mt-2")}>AI CHAT</Text>
              </View>
              <View
                className={cn("px-3 py-2.5 items-center")}
                style={{ backgroundColor: '#55ac8cff' }}
              >
                <Text className={cn("text-white text-xs font-semibold")}>Ask questions about your memories</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Second Row */}
        <View className={cn("flex-row justify-between")} style={{ height: '38%' }}>
          {/* Quiz Card */}
          <TouchableOpacity
            onPress={handleNavigateToQuiz}
            activeOpacity={0.8}
            className={cn("flex-1 mr-2")}
          >
            <View
              className={cn("bg-white overflow-hidden h-full")}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 30,
                borderBottomRightRadius: 30,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View className={cn("flex-1 items-center justify-center pt-4")}>
                <View>
                  <MaterialCommunityIcons name="brain" size={52} color="#7579c7ff" />
                </View>
                <Text className={cn("text-sm font-bold text-gray-800 text-center mt-2")}>QUIZ</Text>
              </View>
              <View
                className={cn("px-3 py-2.5 items-center")}
                style={{ backgroundColor: '#7579c7ff' }}
              >
                <Text className={cn("text-white text-xs font-semibold")}>Answer personalized quizzes</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Reminisce Card */}
          <TouchableOpacity
            onPress={handleNavigateToReminisce}
            activeOpacity={0.8}
            className={cn("flex-1 ml-2")}
          >
            <View
              className={cn("bg-white overflow-hidden h-full")}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: 30,
                borderBottomRightRadius: 30,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View className={cn("flex-1 items-center justify-center pt-4")}>
                <View>
                  <MaterialCommunityIcons name="meditation" size={52} color="#eb79c5ff" />
                </View>
                <Text className={cn("text-sm font-bold text-gray-800 text-center mt-2")}>RECALL MEMORIES</Text>
              </View>
              <View
                className={cn("px-3 py-2.5 items-center")}
                style={{ backgroundColor: '#eb79c5ff' }}
              >
                <Text className={cn("text-white text-xs font-semibold")}>Connect with your past memories</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}