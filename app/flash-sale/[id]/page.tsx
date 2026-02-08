"use client";

import React, { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function FlashSaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  useEffect(() => {
    if (!id) return;
    // Replace current entry with feed+modal deep-link
    try {
      router.replace(`/flash-sale?modal=${id}`);
    } catch (e) {
      router.push(`/flash-sale?modal=${id}`);
    }
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );
}
