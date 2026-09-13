/** A run of bytes destined for one address in the target's memory map. */
export type Segment = {
  address: number
  data: Uint8Array
}

export function endOf(segment: Segment) {
  return segment.address + segment.data.length
}

/** Sorts by address and joins runs that touch. Overlaps are a broken image and throw. */
export function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].filter((segment) => segment.data.length > 0).sort((a, b) => a.address - b.address)
  const merged: Segment[] = []

  for (const segment of sorted) {
    const last = merged[merged.length - 1]

    if (last && segment.address < endOf(last)) {
      throw new Error(`Segments overlap at 0x${segment.address.toString(16)}`)
    }

    if (last && segment.address === endOf(last)) {
      const joined = new Uint8Array(last.data.length + segment.data.length)
      joined.set(last.data, 0)
      joined.set(segment.data, last.data.length)
      last.data = joined
    } else {
      merged.push({ address: segment.address, data: segment.data })
    }
  }

  return merged
}

export function totalBytes(segments: Segment[]) {
  return segments.reduce((sum, segment) => sum + segment.data.length, 0)
}

export function hex(value: number, width = 8) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}
