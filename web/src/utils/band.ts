export const BANDS: readonly number[] = [1, 3, 5, 8, 38, 39, 40, 41]

const GROUPS = 8
const BITS_PER_GROUP = 8

export const ALL_BAND_STR = '149,0,0,0,224,1,0,0'

export function strToBits(s: string): boolean[] {
  const bits = new Array<boolean>(GROUPS * BITS_PER_GROUP).fill(false)
  const parts = (s ?? '').split(',')
  for (let g = 0; g < GROUPS; g++) {
    const v = Number.parseInt(parts[g] ?? '', 10) || 0
    for (let i = 0; i < BITS_PER_GROUP; i++) {
      bits[g * BITS_PER_GROUP + i] = (v & (1 << i)) !== 0
    }
  }
  return bits
}

export function bitsToStr(bits: readonly boolean[]): string {
  const out: number[] = []
  for (let g = 0; g < GROUPS; g++) {
    let v = 0
    for (let i = 0; i < BITS_PER_GROUP; i++) {
      if (bits[g * BITS_PER_GROUP + i]) v |= 1 << i
    }
    out.push(v)
  }
  return out.join(',')
}

export function bandsToStr(bands: readonly number[]): string {
  const bits = new Array<boolean>(GROUPS * BITS_PER_GROUP).fill(false)
  for (const b of bands) {
    if (b >= 1 && b <= GROUPS * BITS_PER_GROUP) bits[b - 1] = true
  }
  return bitsToStr(bits)
}

export function strToBands(s: string): number[] {
  const bits = strToBits(s)
  const out: number[] = []
  for (let i = 0; i < bits.length; i++) if (bits[i]) out.push(i + 1)
  return out
}

export function normalizeWorkBand(v: string): string {
  const s = (v ?? '').trim()
  if (!s) return ''
  if (s.includes(',')) {

    const parts = s.split(',').slice(0, GROUPS)
    while (parts.length < GROUPS) parts.push('0')
    return parts.map((x) => String(Number.parseInt(x, 10) || 0)).join(',')
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || n < 1) return ''
  return bandsToStr([n])
}

export function bandNames(s: string): string {
  const b = strToBands(s)
  if (!b.length) return '--'
  return b.map((x) => 'B' + x).join(' ')
}

export const isAllBands = (s: string): boolean => normalizeWorkBand(s) === ALL_BAND_STR
