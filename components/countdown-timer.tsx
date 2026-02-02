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
    return (
      <div className="font-mono font-bold tracking-widest tabular-nums">
        {timeLeft.days}日 {formatNumber(timeLeft.hours)}時 {formatNumber(timeLeft.minutes)}分 {formatNumber(timeLeft.seconds)}秒
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-2xl font-bold">
      {timeLeft.days > 0 && (
        <>
          <div className="flex flex-col items-center">
            <span className="bg-primary text-primary-foreground px-3 py-2 rounded-lg min-w-[3rem] text-center">
              {timeLeft.days}
            </span>
            <span className="text-xs text-muted-foreground mt-1">日</span>
          </div>
          <span className="text-primary text-xl">:</span>
        </>
      )}
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-3 py-2 rounded-lg min-w-[3rem] text-center">
          {formatNumber(timeLeft.hours)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">時</span>
      </div>
      <span className="text-primary text-xl">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-3 py-2 rounded-lg min-w-[3rem] text-center">
          {formatNumber(timeLeft.minutes)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">分</span>
      </div>
      <span className="text-primary text-xl">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground px-3 py-2 rounded-lg min-w-[3rem] text-center animate-pulse">
          {formatNumber(timeLeft.seconds)}
        </span>
        <span className="text-xs text-muted-foreground mt-1">秒</span>
      </div>
    </div>
  );
}
