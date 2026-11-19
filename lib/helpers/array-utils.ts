export function arrSum<T>(arr: T[], key: keyof T): number {
  return arr.reduce((sum, item) => sum + Number(item[key]), 0);
}

export function arrMin<T>(arr: T[], key: keyof T): number {
  if (!arr.length) return 0;
  return arr.reduce((min, item) => {
    const v = Number(item[key]);
    return v < min ? v : min;
  }, Number(arr[0][key]));
}

export function arrMax<T>(arr: T[], key: keyof T): number {
  if (!arr.length) return 0;
  return arr.reduce((max, item) => {
    const v = Number(item[key]);
    return v > max ? v : max;
  }, Number(arr[0][key]));
}

export function arrUnique<T>(arr: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return arr.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function arrSortAsc<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => {
    if (a[key] > b[key]) return 1;
    if (a[key] < b[key]) return -1;
    return 0;
  });
}

export function arrSortDesc<T>(arr: T[], key: keyof T): T[] {
  return [...arr].sort((a, b) => {
    if (a[key] > b[key]) return -1;
    if (a[key] < b[key]) return 1;
    return 0;
  });
}

export function arrRemove<T>(arr: T[], key: keyof T, match: unknown): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] == match) {
      arr.splice(i, 1);
      return true;
    }
  }
  return false;
}
