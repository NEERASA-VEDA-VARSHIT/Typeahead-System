/**
 * ConsistentHashRing
 *
 * Distributes cache keys across N physical cache nodes using a hash ring.
 * Uses 100 virtual nodes per physical node for balanced distribution.
 *
 * Why consistent hashing?
 *   Traditional modulo-based routing (key % N) causes nearly all keys to
 *   remap when a node is added/removed. Consistent hashing minimizes
 *   remapping to only keys that hash near the change point on the ring.
 *
 * Why virtual nodes?
 *   Without virtual nodes, a small number of physical nodes creates
 *   uneven key distribution. Virtual nodes spread each physical node
 *   across the ring, achieving near-uniform load balancing.
 */

export class ConsistentHashRing {
  // Sorted array of [hash, nodeName] entries
  private ring: { hash: number; node: string }[] = [];
  private nodes = new Set<string>();
  private readonly virtualNodes: number;

  constructor(virtualNodes = 100) {
    this.virtualNodes = virtualNodes;
  }

  /**
   * Simple string hash (djb2 variant).
   * Returns a 32-bit unsigned integer.
   */
  private hash(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return hash >>> 0;
  }

  /**
   * Add a physical node to the ring.
   * Creates `virtualNodes` replicas, each with a unique suffix,
   * hashed and placed on the ring.
   */
  addNode(nodeName: string): void {
    if (this.nodes.has(nodeName)) return;
    this.nodes.add(nodeName);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeName}:vnode:${i}`;
      const h = this.hash(virtualKey);
      this.ring.push({ hash: h, node: nodeName });
    }

    // Keep ring sorted by hash for binary search
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  /**
   * Remove a physical node and all its virtual replicas.
   */
  removeNode(nodeName: string): void {
    this.nodes.delete(nodeName);
    this.ring = this.ring.filter((e) => e.node !== nodeName);
  }

  /**
   * Get the responsible node for a given key.
   * Hashes the key, then walks clockwise to find the first node
   * whose hash >= key hash. Wraps around to the first node if
   * no such node exists.
   */
  getNode(key: string): string | null {
    if (this.ring.length === 0) return null;

    const h = this.hash(key);

    // Binary search for the first hash >= h
    let lo = 0;
    let hi = this.ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].hash >= h) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    // Wrap around if no node found
    const entry = this.ring[lo % this.ring.length];

    console.log(`[ConsistentHash] prefix="${key}" hash=${h} node="${entry.node}"`);
    return entry.node;
  }

  getNodes(): string[] {
    return Array.from(this.nodes);
  }

  ringSize(): number {
    return this.ring.length;
  }
}
