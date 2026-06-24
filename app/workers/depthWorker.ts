import { pipeline, env } from '@xenova/transformers';

// Skip local model check since we are downloading from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task: any = 'depth-estimation';
  static model = 'Xenova/depth-anything-small-hf';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
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
      self.postMessage({ status: 'progress', progress: x });
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
