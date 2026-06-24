"use client";
import React, { useState, useEffect } from "react";

export default function TestPage() {
  const [log, setLog] = useState<string>("Running...");

  useEffect(() => {
    (async () => {
      try {
        setLog("Importing transformers...");
        const transformers = await import('@xenova/transformers');
        const env = transformers.env;
        const pipeline = transformers.pipeline;
        
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        
        setLog(l => l + "\nInitializing pipeline...");
        
        await pipeline(
          'depth-estimation',
          'Xenova/depth-anything-small-hf',
          {
            progress_callback: (x: any) => {
              setLog(l => l + "\nProgress: " + JSON.stringify(x));
            }
          }
        );
        
        setLog(l => l + "\nPipeline success!");
      } catch (err: any) {
        setLog(l => l + "\nError: " + err?.message + "\nStack: " + err?.stack);
      }
    })();
  }, []);

  return <pre className="text-white p-4 text-xs">{log}</pre>;
}
