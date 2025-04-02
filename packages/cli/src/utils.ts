export function diffArrays<T>(a: T[], b: T[]): {
  added: T[];
  removed: T[];
  unchanged: T[];
} {
  const aSet = new Set<T>(a);
  const bSet = new Set<T>(b);

  // 预分配数组空间（根据经验值优化）
  const added: T[] = [];
  const removed: T[] = [];
  const unchangedSet = new Set<T>();

  // 单次遍历新数组
  for (const item of b) {
    aSet.has(item) ? unchangedSet.add(item) : added.push(item);
  }

  // 单次遍历旧数组
  for (const item of a) {
    !bSet.has(item) && removed.push(item);
  }

  return {
    added,
    removed,
    unchanged: Array.from(unchangedSet)
  };
}