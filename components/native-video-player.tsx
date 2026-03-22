"use client";

import React, { useEffect, useRef, useState } from "react";

interface Props {
  url?: string;
  poster?: string;
  isActive?: boolean;
}

export default function NativeVideoPlayer({ url, poster, isActive }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const attemptPlay = async () => {
      try {
        if (isActive) {
          await el.play();
          setIsPlaying(true);
        } else {
          el.pause();
          setIsPlaying(false);
        }
      } catch (err) {
        setError(err);
        // Don't spam console with empty objects — provide helpful debug info
        console.debug('NativeVideoPlayer: play() failed', err);
      }
    };

    const onCanPlay = () => {
      if (isActive) attemptPlay();
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = (ev: any) => {
      const detail = ev?.target?.error || ev?.message || ev;
      setError(detail);
      console.debug('NativeVideoPlayer: video error', detail);
    };

    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError as EventListener);

    // initial attempt
    attemptPlay();

    return () => {
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError as EventListener);
    };
  }, [url, isActive]);

  if (!url) return <div className="w-full h-full flex items-center justify-center text-zinc-400">No video</div>;

  return (
    <div className="w-full h-full relative">
      <video
        ref={ref}
        src={url}
        className="w-full h-full object-cover object-center"
        playsInline
        controls
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40">
          <div className="text-sm">Video error</div>
        </div>
      )}
    </div>
  );
}
