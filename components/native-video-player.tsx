"use client"

import { useRef, useEffect, useState } from "react"
import { Play, Volume2, VolumeX } from "lucide-react"

interface NativeVideoPlayerProps {
  url: string
  poster?: string
  isActive: boolean
}

export default function NativeVideoPlayer({ url, poster, isActive }: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const longPressTimeoutRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const wasPlayingBeforeRef = useRef(false)

  useEffect(() => {
    if (isActive) {
      if (videoRef.current) {
        // Ensure muted is set for autoplay policy
        videoRef.current.muted = true;
        setIsMuted(true);
        // Reset to beginning if needed or just play
        const playPromise = videoRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((error) => {
              console.log("Autoplay prevented:", error)
              setIsPlaying(false)
            })
        }
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }, [isActive])

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setIsMuted(videoRef.current.muted)
    }
  }

  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center z-0 cursor-pointer group"
      onPointerDown={(e) => {
        e.stopPropagation();
        // record whether it was playing before long press
        wasPlayingBeforeRef.current = !!(videoRef.current && !videoRef.current.paused)
        longPressTriggeredRef.current = false
        if (longPressTimeoutRef.current) {
          window.clearTimeout(longPressTimeoutRef.current)
          longPressTimeoutRef.current = null
        }
        longPressTimeoutRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true
          // pause while holding
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause()
            setIsPlaying(false)
          }
        }, 350)
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (longPressTimeoutRef.current) {
          window.clearTimeout(longPressTimeoutRef.current)
          longPressTimeoutRef.current = null
        }
        if (longPressTriggeredRef.current) {
          // was a long press: resume if it was playing before
          longPressTriggeredRef.current = false
          if (wasPlayingBeforeRef.current && videoRef.current) {
            const p = videoRef.current.play()
            if (p !== undefined) {
              p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
            }
          }
          return
        }
        // short tap: toggle mute
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted
          setIsMuted(videoRef.current.muted)
        }
      }}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onTouchEnd={(e) => { e.stopPropagation(); }}
    >
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        className="w-full h-full object-contain relative z-10 pointer-events-none"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        muted
        loop
      />
    </div>
  )
}
