import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

export function useKeyboard(): { height: number } {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return { height }
}

