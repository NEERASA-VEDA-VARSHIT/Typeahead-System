import { ConsistentHashRing } from "./ConsistentHashRing";
import { CacheNode, Suggestion } from "./CacheNode";

/**
 * CacheManager
 *
 * Top-level cache orchestrator. Initializes 4 logical cache nodes,
 * registers them on a consistent hash ring, and routes all
 * get/set/invalidate operations to the correct node.
 */
export class CacheManager {
  private ring: ConsistentHashRing;
  private nodes: Map<string, CacheNode> = new Map();
  public cacheHits = 0;
  public cacheMisses = 0;

  constructor() {
    this.ring = new ConsistentHashRing(100);

    // Create 4 logical cache nodes
    for (let i = 1; i <= 4; i++) {
      const node = new CacheNode(`cache-node-${i}`);
      this.nodes.set(node.name, node);
      this.ring.addNode(node.name);
    }

    console.log(`[CacheManager] Initialized ${this.nodes.size} cache nodes with ${this.ring.ringSize()} virtual nodes`);
  }

  /**
   * Route to the correct cache node via consistent hashing and attempt a read.
   */
  get(prefix: string): { data: Suggestion[]; node: string; hit: boolean } | null {
    const nodeName = this.ring.getNode(prefix);
    if (!nodeName) return null;

    const node = this.nodes.get(nodeName);
    if (!node) return null;

    const data = node.get(prefix);
    if (data) {
      this.cacheHits++;
      return { data, node: nodeName, hit: true };
    }

    this.cacheMisses++;
    return { data: [], node: nodeName, hit: false };
  }

  /**
   * Store data on the responsible cache node.
   */
  set(prefix: string, data: Suggestion[]): void {
    const nodeName = this.ring.getNode(prefix);
    if (!nodeName) return;

    const node = this.nodes.get(nodeName);
    if (!node) return;

    node.set(prefix, data);
  }

  /**
   * Invalidate a prefix on the responsible node.
   */
  invalidate(prefix: string): void {
    const nodeName = this.ring.getNode(prefix);
    if (!nodeName) return;

    const node = this.nodes.get(nodeName);
    if (!node) return;

    node.delete(prefix);
  }

  getNodeByName(name: string): CacheNode | undefined {
    return this.nodes.get(name);
  }

  getRing(): ConsistentHashRing {
    return this.ring;
  }

  debug(prefix: string): {
    prefix: string;
    hash: number;
    node: string;
    status: string;
  } | { status: string } {
    const nodeName = this.ring.getNode(prefix);
    if (!nodeName) return { status: "MISS" };

    // Re-hash for display
    let hash = 5381;
    for (let i = 0; i < prefix.length; i++) {
      hash = ((hash << 5) + hash + prefix.charCodeAt(i)) & 0xffffffff;
    }

    const node = this.nodes.get(nodeName);
    const hit = node ? node.get(prefix) !== null : false;

    return {
      prefix,
      hash: hash >>> 0,
      node: nodeName,
      status: hit ? "HIT" : "MISS",
    };
  }
}
