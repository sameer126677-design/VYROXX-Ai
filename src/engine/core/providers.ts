export type ImageProviderCapability = 'text-to-image' | 'image-edit' | 'image-variation';
export interface ImageGenerationRequest {
  prompt: string;
  width: number;
  height: number;
  style?: string;
  referenceAssetIds?: string[];
  purpose: 'character' | 'environment' | 'prop' | 'texture' | 'keyframe' | 'other';
}
export interface GeneratedImageAsset {
  id: string;
  uri: string;
  mimeType: string;
  providerId: string;
  width?: number;
  height?: number;
  metadata?: Record<string, string>;
}
export interface ImageProvider {
  id: string;
  label: string;
  capabilities: ImageProviderCapability[];
  generate(request: ImageGenerationRequest, signal?: AbortSignal): Promise<GeneratedImageAsset>;
}
/** Provider registry is deliberately separate from the planner model registry. */
export class ImageProviderRegistry {
  private providers = new Map<string, ImageProvider>();
  private activeProviderId: string | null = null;

  register(provider: ImageProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.activeProviderId) this.activeProviderId = provider.id;
  }
  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) throw new Error(`Unknown image provider: ${providerId}`);
    this.activeProviderId = providerId;
  }
  getActive(): ImageProvider | null {
    return this.activeProviderId ? this.providers.get(this.activeProviderId) ?? null : null;
  }
  list(): Array<Pick<ImageProvider, 'id' | 'label' | 'capabilities'>> {
    return [...this.providers.values()].map(({ id, label, capabilities }) => ({ id, label, capabilities }));
  }
  async generateOnDemand(request: ImageGenerationRequest, signal?: AbortSignal): Promise<GeneratedImageAsset> {
    const provider = this.getActive();
    if (!provider) throw new Error('No image provider is configured. Local VYROXX rendering remains available.');
    if (!provider.capabilities.includes('text-to-image')) throw new Error(`Provider ${provider.id} does not support text-to-image.`);
    return provider.generate(request, signal);
  }
}
