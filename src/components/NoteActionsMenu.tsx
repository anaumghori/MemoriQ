import { memo } from "react"
import { View, Text, TouchableOpacity, Alert } from "react-native"
import { useRouter } from "expo-router"
import { cn } from "../lib/utils"
import { deleteNote } from "../database/notesOperations"

interface NoteActionsMenuProps {
  noteId: string
  isVisible: boolean
  onClose: () => void
  onDeleteSuccess?: () => void
}

function NoteActionsMenu({ noteId, isVisible, onClose, onDeleteSuccess }: NoteActionsMenuProps) {
  const router = useRouter()

  const handleEdit = () => {
    onClose()
    router.push(`/newNote?id=${noteId}`)
  }

  const handleDelete = () => {
    onClose()

    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteNote(parseInt(noteId))
              if (onDeleteSuccess) {
                onDeleteSuccess()
              } else {
                router.replace("/notes")
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete note")
            }
          }
        }
      ]
    )
  }

  if (!isVisible) return null

  return (
    <View className={cn("absolute right-2 top-10 z-10 bg-white rounded-xl border border-gray-300 overflow-hidden")}>
      <TouchableOpacity
        onPress={handleEdit}
        className={cn("px-6 py-3")}
        accessibilityLabel="Edit note"
      >
        <Text className={cn("text-gray-700 text-base font-medium")}> Edit </Text>
      </TouchableOpacity>
      <View className={cn("h-px bg-gray-100")} />
      <TouchableOpacity
        onPress={handleDelete}
        className={cn("px-6 py-3")}
        accessibilityLabel="Delete note"
      >
        <Text className={cn("text-red-600 text-base font-medium")}> Delete </Text>
      </TouchableOpacity>
    </View>
  )
}

export default memo(NoteActionsMenu)
