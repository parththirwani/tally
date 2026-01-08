interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export const formatDuration = (seconds: number): string => {
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
};

const formatDateLabel = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getTodayRange = (now: Date): { startDate: Date; endDate: Date; label: string } => {
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { startDate, endDate, label: "Today" };
};

const getYesterdayRange = (now: Date): { startDate: Date; endDate: Date; label: string } => {
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
  return { startDate, endDate, label: "Yesterday" };
};

const getWeekRange = (now: Date): { startDate: Date; endDate: Date; label: string } => {
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - diff), 23, 59, 59);
  return { startDate, endDate, label: "This Week" };
};

const getMonthRange = (now: Date): { startDate: Date; endDate: Date; label: string } => {
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const label = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { startDate, endDate, label };
};

const getSpecificDateRange = (dateString: string): { startDate: Date; endDate: Date; label: string } => {
  const startDate = new Date(dateString + "T00:00:00");
  const endDate = new Date(dateString + "T23:59:59");
  return { startDate, endDate, label: formatDateLabel(startDate) };
};

export const getDateRange = (period: string): DateRange => {
  const now = new Date();

  // Check if it's a specific date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    const { startDate, endDate, label } = getSpecificDateRange(period);
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      label,
    };
  }

  let range: { startDate: Date; endDate: Date; label: string };

  switch (period.toLowerCase()) {
    case "today":
      range = getTodayRange(now);
      break;
    case "yesterday":
      range = getYesterdayRange(now);
      break;
    case "week":
      range = getWeekRange(now);
      break;
    case "month":
      range = getMonthRange(now);
      break;
    default:
      range = getTodayRange(now);
  }

  return {
    startDate: range.startDate.toISOString().split("T")[0],
    endDate: range.endDate.toISOString().split("T")[0],
    label: range.label,
  };
};