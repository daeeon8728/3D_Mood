import { pipeline, env } from '@xenova/transformers';

// Configure environment for browser
env.allowLocalModels = false;
env.useBrowserCache = true;
// Limit threads to prevent hanging in Web Workers on some browsers
if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

class PipelineSingleton {
  static task: any = 'depth-estimation';
  static model = 'Xenova/depth-anything-small-hf';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      try {
        this.instance = await pipeline(this.task, this.model, { progress_callback });
      } catch (err: any) {
        console.error("Pipeline initialization failed:", err);
        throw err;
      }
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  try {
    const { imageUrl } = event.data;
    if (!imageUrl) return;

    self.postMessage({ status: 'loading', message: 'Loading AI model...' });

    const depthEstimator = await PipelineSingleton.getInstance((x: any) => {
      // x is an object: { status: 'progress' | 'download' | 'initiate' | 'done', progress: number, file: string }
      self.postMessage({ status: 'progress', data: x });
    });

    self.postMessage({ status: 'processing', message: 'Estimating depth...' });

    // Run depth estimation
    const output = await depthEstimator(imageUrl);
    const depthImage = output.depth; // RawImage
    
    // Convert to a regular array or clone the buffer for transferring
    // The data is likely a Uint8ClampedArray or Uint8Array. 
    // We can transfer it for performance
    const dataBuffer = depthImage.data.slice(0).buffer;
    const _self = self as unknown as Worker;
    _self.postMessage({
      status: 'complete',
      width: depthImage.width,
      height: depthImage.height,
      channels: depthImage.channels,
      data: dataBuffer
    }, [dataBuffer]); // Transferable object

  } catch (err: any) {
    console.error(err);
    self.postMessage({ status: 'error', message: err?.message || 'Error running depth estimation' });
  }
});
