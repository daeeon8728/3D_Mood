import { pipeline, env } from '@xenova/transformers';

// Configure environment for browser
env.allowLocalModels = false;
env.useBrowserCache = true;

// WASM backend config – single thread, no proxy, local WASM files
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.wasmPaths = '/onnx/';
}

// ── Forward ALL unhandled errors from the worker back to main thread ──
self.addEventListener('error', (e: ErrorEvent) => {
  self.postMessage({ status: 'error', message: e.message });
});
self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  self.postMessage({ status: 'error', message: String(e.reason) });
});

class PipelineSingleton {
  static task: any = 'depth-estimation';
  static model = 'Xenova/depth-anything-small-hf';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      self.postMessage({ status: 'loading', message: 'LOADING AI MODEL...' });
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  try {
    const { imageUrl } = event.data;
    if (!imageUrl) return;

    const depthEstimator = await PipelineSingleton.getInstance((x: any) => {
      // Forward every progress tick (download progress, initiate, done...)
      if (x && typeof x.progress === 'number') {
        self.postMessage({ status: 'progress', data: x });
      }
    });

    self.postMessage({ status: 'processing', message: 'ESTIMATING DEPTH...' });

    const output = await depthEstimator(imageUrl);
    const depthImage = output.depth;

    const dataBuffer = depthImage.data.slice(0).buffer;
    const _self = self as unknown as Worker;
    _self.postMessage({
      status: 'complete',
      width: depthImage.width,
      height: depthImage.height,
      channels: depthImage.channels,
      data: dataBuffer
    }, [dataBuffer]);

  } catch (err: any) {
    console.error('[DepthWorker]', err);
    self.postMessage({ status: 'error', message: err?.message || String(err) });
  }
});
