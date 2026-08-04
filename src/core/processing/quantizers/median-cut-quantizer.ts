import { quantizeImage } from '@/core/processing/quantization'
import type { Quantizer } from '@/core/processing/quantizers/quantizer'

export const medianCutQuantizer: Quantizer = {
  id: 'median-cut',
  quantize: quantizeImage,
}
