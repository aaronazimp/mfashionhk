"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: Date;
  size?: "default" | "sm";
}

export function CountdownTimer({ targetDate, size = "default" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const formatNumber = (num: number) => num.toString().padStart(2, "0");

  if (size === "sm") {
    // Adaptive compact format:
    // - >= 1 day: show days + hh:mm:ss
    // - >= 1 hour and < 1 day: show total hours + mm:ss
    // - >= 1 minute and < 1 hour: show mm:ss
    // - < 1 minute: show ss
    const totalSeconds = timeLeft.days * 86400 + timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds;
    if (totalSeconds <= 0) {
      return (
        <div className="font-mono font-bold tracking-widest tabular-nums text-xs text-red-600 px-2 py-1 rounded">00秒</div>
      )
    }

    if (totalSeconds >= 86400) {
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return (
        <div className="font-mono font-bold tracking-widest tabular-nums text-xs text-red-600 px-2 py-1 rounded">
          {formatNumber(days)}<span className="mx-1">日</span>
          {formatNumber(hours)}<span className="mx-1">時</span>{formatNumber(minutes)}<span className="mx-1">分</span>{formatNumber(seconds)}<span className="mx-1">秒</span>
        </div>
      )
    }

    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return (
        <div className="font-mono font-bold tracking-widest tabular-nums text-xs text-red-600 px-2 py-1 rounded">
          {formatNumber(hours)}<span className="mx-1">時</span>{formatNumber(minutes)}<span className="mx-1">分</span>{formatNumber(seconds)}<span className="mx-1">秒</span>
        </div>
      )
    }

    if (totalSeconds >= 60) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return (
        <div className="font-mono font-bold tracking-widest tabular-nums text-xs text-red-600 px-2 py-1 rounded">
          {formatNumber(minutes)}<span className="mx-1">分</span>{formatNumber(seconds)}<span className="mx-1">秒</span>
        </div>
      )
    }

    // less than 1 minute
    return (
      <div className="font-mono font-bold tracking-widest tabular-nums text-xs text-red-600 px-2 py-1 rounded">
        {formatNumber(totalSeconds)}<span className="mx-1">秒</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 text-lg font-bold text-red-600 px-3 py-1 rounded-lg">
      {timeLeft.days > 0 && (
        <>
          <div className="flex flex-col items-center">
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded-lg min-w-[2.25rem] text-center">
              {timeLeft.days}
            </span>
            <span className="text-xs text-muted-foreground mt-1">日</span>
          </div>
          <span className="text-red-600 text-xl">:</span>
        </>
      )}
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-2 py-1 rounded-lg min-w-[2.25rem] text-center">
          {formatNumber(timeLeft.hours)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">時</span>
      </div>
      <span className="text-red-600 text-xl">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-2 py-1 rounded-lg min-w-[2.25rem] text-center">
          {formatNumber(timeLeft.minutes)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">分</span>
      </div>
      <span className="text-red-600 text-xl">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-2 py-1 rounded-lg min-w-[2.25rem] text-center animate-pulse">
          {formatNumber(timeLeft.seconds)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">秒</span>
      </div>
    </div>
  );
}
