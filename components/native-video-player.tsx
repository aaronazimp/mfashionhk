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
      onClick={togglePlay}
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
      
      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none bg-black/20">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Mute Control */}
      <button 
        onClick={toggleMute}
        className="absolute bottom-24 right-4 z-30 p-2 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 transition-colors pointer-events-auto"
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
    </div>
  )
}
