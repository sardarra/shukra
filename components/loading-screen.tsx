'use client'

import { useEffect } from "react";
import { Spinner } from "./ui/spinner";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function LoadingScreen() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // adsbygoogle not ready yet
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6">
      {/* AdSense unit */}
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-6735230075764523"
        data-ad-slot="2754004462"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />

      <Spinner className="size-10 animate-spin" style={{ color: "#7C6103" }} />

      <p className="text-sm text-muted-foreground">Powering up Shukra</p>
    </div>
  );
}
