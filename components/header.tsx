"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Header() {
  return null;
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/m+logo_final_colorBG.png"
              alt="M+ Fashion"
              width={40}
              height={40}
              className="h-10 w-auto rounded-md"
            />
            
          </Link>
        </div>
      </div>
    </header>
  );
}
