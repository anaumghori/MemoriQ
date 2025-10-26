import { memo, useMemo, useCallback, useEffect, useState } from "react"
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter, useFocusEffect } from "expo-router"
import Header from "../components/Header"
import { Feather } from "@expo/vector-icons"
import Entypo from "@expo/vector-icons/Entypo"
import { cn } from "../lib/utils"
import { getAllNotes, searchNotes, formatNoteForUI } from "../database/notesOperations"
import NoteActionsMenu from "../components/NoteActionsMenu"

type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string // formatted string, e.g., "Nov 20 • 12:27 PM"
}

export default function NotesPage() {
  const [query, setQuery] = useState("")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [searchResults, setSearchResults] = useState<Note[] | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const listContentStyle = useMemo(() => ({ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 100, gap: 16 }), [])

  // Load notes on component mount
  useEffect(() => {
    loadNotes()
  }, [])
  useFocusEffect(
    useCallback(() => {
      loadNotes()
    }, [])
  )

  // Load all notes from database
  const loadNotes = async () => {
    try {
      setLoading(true)
      const dbNotes = await getAllNotes()
      const formattedNotes = dbNotes.map(formatNoteForUI)
      setNotes(formattedNotes)
    } catch (error) {
      Alert.alert('Error', 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  // Search notes when query changes (DB-backed). When empty, show full list.
  useEffect(() => {
    let active = true
    async function performSearch() {
      if (!query.trim()) {
        setSearchResults(null)
        return
      }
      try {
        const results = await searchNotes(query)
        if (!active) return
        const formattedResults = results.map(formatNoteForUI)
        setSearchResults(formattedResults)
      } catch {
        if (!active) return
        setSearchResults([])
      }
    }
    performSearch()
    return () => {
      active = false
    }
  }, [query])

  const filteredNotes = useMemo(() => searchResults ?? notes, [searchResults, notes])
  const handleCreateNote = () => {
    router.push("/newNote")
  }
  const handleViewNote = (noteId: string) => {
    router.push(`/viewNote?id=${noteId}`)
  }

  const renderItem = useCallback(({ item }: { item: Note }) => (
    <NoteCard
      item={item}
      isMenuOpen={openMenuId === item.id}
      onPressView={handleViewNote}
      onToggleMenu={(id) => setOpenMenuId(openMenuId === id ? null : id)}
      onDeleteSuccess={loadNotes}
    />
  ), [openMenuId])

  interface NoteCardProps {
    item: Note
    isMenuOpen: boolean
    onPressView: (id: string) => void
    onToggleMenu: (id: string) => void
    onDeleteSuccess: () => void
  }

  const NoteCard = memo(({ item, isMenuOpen, onPressView, onToggleMenu, onDeleteSuccess }: NoteCardProps) => (
    <View
      className={cn("relative bg-white rounded-2xl mx-1 overflow-hidden")}
      style={{
        borderRightWidth: 5,
        borderBottomWidth: 5,
        borderRightColor: '#14a373ff',
        borderBottomColor: '#14a373ff',
      }}
    >
      <TouchableOpacity
        onPress={() => onPressView(item.id)}
        activeOpacity={0.7}
        className={cn("p-4")}
      >
        <View className={cn("flex-row items-start")}>
          <View className={cn("flex-1 pr-8")}> 
            <Text className={cn("text-gray-500 text-sm mb-2")}> {item.createdAt} </Text>
            <Text className={cn("text-gray-900 font-semibold text-lg mb-2")} numberOfLines={1}> {item.title} </Text>
            <Text className={cn("text-gray-600 text-md leading-6 mb-3")} numberOfLines={2}> {item.content} </Text>
            <View className={cn("flex-row flex-wrap gap-2")}>
              {item.tags.map((tag) => (
                <View key={tag} className={cn("px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-600")}>
                  <Text className={cn("text-emerald-700 text-sm font-medium")}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation()
              onToggleMenu(item.id)
            }}
            accessibilityLabel="More options"
            accessibilityRole="button"
            className={cn("p-2 -mr-2 -mt-2")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Entypo name="dots-three-vertical" size={17} color="#8b919cff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <NoteActionsMenu
        noteId={item.id}
        isVisible={isMenuOpen}
        onClose={() => onToggleMenu(item.id)}
        onDeleteSuccess={onDeleteSuccess}
      />
    </View>
  ))

  if (loading) {
    return (
      <SafeAreaView className={cn("flex-1 bg-gray-50")}>
        <Header title="Notes" backPath="/" />
        <View className={cn("flex-1 items-center justify-center")}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className={cn("flex-1 bg-gray-50")}>
      <Header title="Notes" backPath="/" />
      {/* Search bar */}
      <View className={cn("px-4 pt-3 pb-2")}>
        <View className={cn("flex-row items-center gap-3 bg-white border border-gray-400 rounded-2xl px-2 mb-4 ")}>
          <Feather name="search" size={20} color="#626665ff" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes..."
            placeholderTextColor="#787e88ff"
            className={cn("flex-1 text-gray-900 text-base")}
            accessibilityLabel="Search notes"
          />
        </View>
      </View>

      {/* Note cards list with spacing */}
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={listContentStyle}
        ItemSeparatorComponent={null}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Notes list"
        ListEmptyComponent={
          <View className={cn("items-center justify-center py-20")}>
            <Text className={cn("text-gray-500 text-lg text-center")}>
              {query.trim() ? "No notes found" : "No notes yet\nTap + to create your first note"}
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={handleCreateNote}
        accessibilityLabel="Create new note"
        accessibilityRole="button"
        className={cn("absolute bottom-24 right-6 bg-emerald-600 rounded-full w-16 h-16 items-center justify-center shadow-xl")}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}
