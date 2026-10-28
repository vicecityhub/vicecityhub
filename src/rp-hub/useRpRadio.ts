import { useEffect, useRef, useState } from 'react'
import { getOrCreateAudio } from '../lib/AudioManager'
import { startRpRadio, toggleRpRadio } from '../lib/rpRadio'

/** Leonida FM for the RP Hub page: the rules live in lib/rpRadio.ts, this only ties them to React state. */
export function useRpRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = getOrCreateAudio()
    audioRef.current = audio
    return startRpRadio(audio, setIsPlaying)
  }, [])

  const toggle = () => toggleRpRadio(audioRef.current, setIsPlaying)

  return { isPlaying, toggle }
}
