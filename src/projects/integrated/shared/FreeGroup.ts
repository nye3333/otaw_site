export type FreeCayleyGraph = [FreeGroupElement, number[]][];

export class FreeGroup {
  readonly gens: FreeGroupElement[];
  readonly id: FreeGroupElement;
  private readonly _nGenerators: number;
  private readonly _maxDepth: number;

  constructor(nGenerators: number, maxDepth: number) {
    this._nGenerators = nGenerators;
    this._maxDepth = maxDepth;
    this.id = new FreeGroupElement(this, []);

    this.gens = [];
    for (let i = 1; i <= nGenerators; i++) {
      this.gens.push(new FreeGroupElement(this, [i]));
      this.gens.push(new FreeGroupElement(this, [-i]));
    }
  }

  get ngen(): number {
    return this.gens.length;
  }

  /** Left Cayley edges v — g·v (prepend generator). Used by the main Cayley plotter. */
  get cayley(): FreeCayleyGraph {
    return this.buildBall((letter, e) => this.leftMul(letter, e));
  }

  /**
   * Right Cayley edges v — v·g (append generator). Same vertex set as `cayley` for a ball about 1,
   * but tree geodesics match **right** multiplication — needed so ⟨w⟩ ladders v ↦ v·w follow genuine
   * axis segments instead of detouring through unrelated generators in the left Cayley metric.
   */
  get cayleyRight(): FreeCayleyGraph {
    return this.buildBall((letter, e) => this.rightMul(letter, e));
  }

  private buildBall(
    step: (letter: number, e: FreeGroupElement) => FreeGroupElement,
  ): FreeCayleyGraph {
    const graph: FreeCayleyGraph = [[this.id, []]];
    const visited = new Map<string, number>();
    visited.set("", 0);

    const queue: number[] = [0];
    let qi = 0;

    while (qi < queue.length) {
      const nidx = queue[qi++]!;
      const [e, cs] = graph[nidx]!;
      const atCap = e.depth >= this._maxDepth;

      for (const g of this.gens) {
        const h = step(g.word[0]!, e);
        const key = h.word.join(",");
        const existing = visited.get(key);

        if (existing !== undefined) {
          cs.push(existing);
        } else if (!atCap) {
          const newIdx = graph.length;
          cs.push(newIdx);
          visited.set(key, newIdx);
          graph.push([h, []]);
          queue.push(newIdx);
        }
      }
    }

    return graph;
  }

  private leftMul(letter: number, e: FreeGroupElement): FreeGroupElement {
    if (e.word.length > 0 && e.word[0] === -letter) {
      return new FreeGroupElement(this, e.word.slice(1));
    }
    return new FreeGroupElement(this, [letter, ...e.word]);
  }

  private rightMul(letter: number, e: FreeGroupElement): FreeGroupElement {
    const w = e.word;
    if (w.length > 0 && w[w.length - 1] === -letter) {
      return new FreeGroupElement(this, w.slice(0, -1));
    }
    return new FreeGroupElement(this, [...w, letter]);
  }
}

export class FreeGroupElement {
  readonly depth: number;

  constructor(readonly grp: FreeGroup, readonly word: number[]) {
    this.depth = word.length;
  }

  mul(o: FreeGroupElement): FreeGroupElement {
    const combined = [...this.word, ...o.word];
    const reduced: number[] = [];
    for (const letter of combined) {
      if (reduced.length > 0 && reduced[reduced.length - 1] === -letter) {
        reduced.pop();
      } else {
        reduced.push(letter);
      }
    }
    return new FreeGroupElement(this.grp, reduced);
  }

  equal(o: FreeGroupElement): boolean {
    return (
      this.word.length === o.word.length &&
      this.word.every((v, i) => v === o.word[i])
    );
  }
}
