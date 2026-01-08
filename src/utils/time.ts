export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function getDateRange(period: string): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let label: string;

  // Check if it's a specific date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    startDate = new Date(period + "T00:00:00");
    endDate = new Date(period + "T23:59:59");
    label = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } else {
    switch (period.toLowerCase()) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        label = "Today";
        break;

      case "yesterday":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        label = "Yesterday";
        break;

      case "week":
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as first day
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - diff), 23, 59, 59);
        label = "This Week";
        break;

      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        label = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        break;

      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        label = "Today";
    }
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    label,
  };
}