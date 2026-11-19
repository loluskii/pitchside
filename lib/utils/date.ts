export function getDateRange(
  period: string,
): { startDate: string; endDate: string } | string | null {
  if (!period) return null;

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case "today":
      return { startDate: fmt(today), endDate: fmt(endOfDay(today)) };
    case "tomorrow": {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      return { startDate: fmt(t), endDate: fmt(endOfDay(t)) };
    }
    case "today_tomorrow": {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      return { startDate: fmt(today), endDate: fmt(endOfDay(t)) };
    }
    case "week": {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { startDate: fmt(start), endDate: fmt(endOfDay(end)) };
    }
    default:
      return period;
  }
}

export function getNext7Days(): string[] {
  const today = new Date();
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function getStartAndEndOfMonth(): { startDate: string; endDate: string } {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    startDate: startOfMonth.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  };
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}
