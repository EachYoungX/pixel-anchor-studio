export interface Quantizer {
  id: string
  quantize(data: Uint8ClampedArray, maxColors: number): Uint8ClampedArray
}
