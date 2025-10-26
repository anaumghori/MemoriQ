import { memo } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { cn } from "../lib/utils"

type HeaderProps = {
  title: string
  backPath?: string
}

function Header({ title, backPath }: HeaderProps) {
  const router = useRouter()

  // Consistent heading style defined once here
  const headingClass = cn("text-gray-800 text-xl font-bold")

  const handleBackPress = () => {
    if (backPath) {
      router.push(backPath)
    }
  }

  return (
    <View
      // Accessibility: identify this as a header region
      accessibilityRole="header"
      className={cn("h-14 bg-white border-b border-gray-200 px-4 flex-row items-center")}
    >
      {/* Left: Arrow icon (functional navigation) */}
      <View className={cn("w-10 items-start justify-center")}>
        {backPath ? (
          <TouchableOpacity
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
        ) : (
          <Feather name="arrow-left" size={24} color="#1F2937" />
        )}
      </View>

      {/* Center: Title */}
      <View className={cn("flex-1 items-center justify-center")}>
        <Text numberOfLines={1} className={headingClass}>
          {title}
        </Text>
      </View>

      {/* Right: Spacer to keep title perfectly centered */}
      <View className={cn("w-10")} />
    </View>
  )
}

export default memo(Header)
