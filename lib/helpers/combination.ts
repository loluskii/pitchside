export class Combination {
  n = 0;
  k = 0;
  data: number[] = [];

  constructor(n?: number, k?: number) {
    if (n !== undefined && k !== undefined) {
      if (n < 0 || k < 0) throw new Error("Negative parameter in constructor");
      this.n = n;
      this.k = k;
      for (let i = 0; i < k; i++) this.data[i] = i;
    }
  }

  successor(): Combination | null {
    if (!this.data.length || this.data[0] === this.n - this.k) return null;
    const result = new Combination(this.n, this.k);
    for (let i = 0; i < this.k; i++) result.data[i] = this.data[i];
    let i = this.k - 1;
    while (i > 0 && result.data[i] === this.n - this.k + i) i--;
    result.data[i]++;
    for (let j = i; j < this.k - 1; j++) result.data[j + 1] = result.data[j] + 1;
    return result;
  }

  first(): Combination {
    const result = new Combination(this.n, this.k);
    for (let i = 0; i < result.k; i++) result.data[i] = i;
    return result;
  }

  applyTo<T>(array: T[]): T[] {
    if (array.length !== this.n)
      throw new Error("Array size not equal to Combination order in ApplyTo()");
    return Array.from({ length: this.k }, (_, i) => array[this.data[i]]);
  }

  choose(n: number, k: number): number {
    if (n < 0 || k < 0) throw new Error("Invalid negative parameter in Choose()");
    if (n < k) return 0;
    if (n === k || k === 0) return 1;
    let delta: number, iMax: number;
    if (k < n - k) {
      delta = n - k;
      iMax = k;
    } else {
      delta = k;
      iMax = n - k;
    }
    let result = delta + 1;
    for (let i = 2; i <= iMax; i++) result = (result * (delta + i)) / i;
    return result;
  }
}

export class FastCombination {
  private create2DArray(rows: number): number[][] {
    return Array.from({ length: rows }, () => []);
  }

  chooseFromSets(setSizes: number[], k: number): number {
    const n = setSizes.length;
    if (k === 0 || k > n) return 0;
    let result = 0;
    const m = this.create2DArray(k + 1);
    for (let y = 1; y <= n - k + 1; y++) {
      if (y === 1) {
        for (let x = 1; x <= k; x++) {
          m[x] ??= [];
          m[x][y] = setSizes.slice(0, x).reduce((product, next) => product * next, 1);
          result = m[x][y];
        }
      } else {
        m[1] ??= [];
        m[1][y] = setSizes.slice(0, y).reduce((a, b) => a + b, 0);
        result = m[1][y];
        for (let x = 2; x <= k; x++) {
          m[x] ??= [];
          m[x][y] = m[x][y - 1] + m[x - 1][y] * setSizes[x + y - 2];
          result = m[x][y];
        }
      }
    }
    return result;
  }
}
