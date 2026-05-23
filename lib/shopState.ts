import { MediaManager, ProductManager } from '@/lib/models'

// Singletons — persist across requests in the same Node.js process
const g = global as typeof global & {
  _mediaManager?: MediaManager
  _productManager?: ProductManager
}

export const mediaManager: MediaManager = g._mediaManager ?? (g._mediaManager = new MediaManager())
export const productManager: ProductManager = g._productManager ?? (g._productManager = new ProductManager())
