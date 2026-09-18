/**
 * Seedable RNG so every simulation is reproducible (same seed + inputs ⇒ identical result).
 * mulberry32 for uniforms, Box–Muller for normals. Tiny, fast, no dependencies.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns a sampler for Normal(mean, stdev). Uses both Box–Muller outputs for efficiency. */
export function makeNormal(seed: number, mean: number, stdev: number): () => number {
  const uniform = mulberry32(seed)
  let spare: number | null = null
  return () => {
    if (stdev === 0) return mean
    if (spare !== null) {
      const z = spare
      spare = null
      return mean + stdev * z
    }
    let u = 0
    while (u === 0) u = uniform() // avoid log(0)
    const v = uniform()
    const r = Math.sqrt(-2 * Math.log(u))
    const theta = 2 * Math.PI * v
    spare = r * Math.sin(theta)
    return mean + stdev * r * Math.cos(theta)
  }
}
