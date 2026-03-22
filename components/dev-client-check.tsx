"use client";

import { useEffect, useState } from "react";

export default function DevClientCheck() {
  const [status, setStatus] = useState("Inline script not run");

  useEffect(() => {
    console.log("DevClientCheck mounted");
    setStatus("Client scripts active (React)");
  }, []);

  return (
    <div id="client-bullet" className="p-3 max-w-4xl mx-auto text-sm text-gray-500">
      {status}
    </div>
  );
}
