export function rgbaToHex(r: number, g: number, b: number, a = 255): string {
  if (a === 0) return '#00000000'
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length === 8) {
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
      Number.parseInt(normalized.slice(6, 8), 16),
    ]
  }
  if (normalized.length !== 6) return [0, 0, 0, 255]
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    255,
  ]
}

export function colorDistanceSquared(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr * 0.2126 + dg * dg * 0.7152 + db * db * 0.0722
}

export function readableTextColor(r: number, g: number, b: number): '#111111' | '#FFFFFF' {
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 145 ? '#111111' : '#FFFFFF'
}

export function rgbToHsl(r: number, g: number, b: number): { hue: number; saturation: number; lightness: number } {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { hue: 0, saturation: 0, lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4
  return { hue: (hue * 60 + 360) % 360, saturation, lightness }
}

export function colorKey(r: number, g: number, b: number, a: number): string {
  return `${r},${g},${b},${a}`
}

export function codeFromIndex(index: number): string {
  const group = Math.floor(index / 9)
  const number = (index % 9) + 1
  let letters = ''
  let value = group
  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters
    value = Math.floor(value / 26) - 1
  } while (value >= 0)
  return `${letters}${number}`
}
