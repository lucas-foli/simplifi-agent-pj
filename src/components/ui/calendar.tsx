import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayPicker,
  useActiveModifiers,
  useDayPicker,
  useNavigation,
} from "react-day-picker";
import { ptBR } from "date-fns/locale";
import {
  addMonths,
  addYears,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfYear,
} from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

type MonthCellProps = {
  monthDate: Date;
};

function MonthCell({ monthDate }: MonthCellProps) {
  const dayPicker = useDayPicker();
  const navigation = useNavigation();
  const activeModifiers = useActiveModifiers(monthDate, monthDate);

  const isSelected = React.useMemo(() => {
    const selectedValue = dayPicker.selected;
    if (!selectedValue) return false;

    if (selectedValue instanceof Date) {
      return isSameMonth(selectedValue, monthDate);
    }

    if (Array.isArray(selectedValue)) {
      return selectedValue.some((date) => isSameMonth(date, monthDate));
    }

    if ("from" in selectedValue) {
      const fromDate = selectedValue.from;
      const toDate = selectedValue.to ?? selectedValue.from;
      if (!fromDate) return false;
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const inRangeStart = monthEnd.getTime() >= fromDate.getTime();
      const inRangeEnd = toDate
        ? monthStart.getTime() <= toDate.getTime()
        : true;
      return inRangeStart && inRangeEnd;
    }

    return false;
  }, [dayPicker.selected, monthDate]);

  const eventModifiers = React.useMemo(
    () => ({
      ...activeModifiers,
      selected: isSelected,
    }),
    [activeModifiers, isSelected]
  );

  const isDisabled = Boolean(activeModifiers.disabled);
  const isToday = Boolean(activeModifiers.today);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      dayPicker.onDayClick?.(monthDate, eventModifiers, event);
      return;
    }

    const targetYearStart = startOfYear(monthDate);
    navigation.goToMonth(targetYearStart);

    dayPicker.onDayClick?.(monthDate, eventModifiers, event);
    dayPicker.onSelect?.(monthDate, monthDate, eventModifiers, event);
  };

  const monthLabel = format(monthDate, "MMMM", { locale: dayPicker.locale });
  const yearLabel = format(monthDate, "yyyy", { locale: dayPicker.locale });

  return (
    <button
      type="button"
      name="month"
      onClick={handleClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      aria-label={`${monthLabel} ${yearLabel}`}
      tabIndex={isSelected ? 0 : -1}
      className={cn(
        buttonVariants({
          variant: isSelected ? "default" : "outline",
          size: "sm",
        }),
        "h-auto min-h-[3.5rem] flex flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 capitalize transition",
        isSelected
          ? "shadow-md"
          : "bg-background hover:bg-accent hover:text-accent-foreground",
        isDisabled &&
          "cursor-not-allowed opacity-50 hover:bg-background hover:text-muted-foreground",
        isToday && !isSelected && "border border-dashed border-primary/50"
      )}
    >
      <span className="text-sm font-medium">{monthLabel}</span>
      <span className="text-xs text-muted-foreground">{yearLabel}</span>
    </button>
  );
}

function MonthGrid() {
  const dayPicker = useDayPicker();
  const navigation = useNavigation();

  const firstDisplayedMonth = navigation.displayMonths[0] ?? new Date();
  const currentYearStart = startOfYear(firstDisplayedMonth);
  const months = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        addMonths(currentYearStart, index)
      ),
    [currentYearStart]
  );

  const minYear = dayPicker.fromDate?.getFullYear() ?? dayPicker.fromYear;
  const maxYear = dayPicker.toDate?.getFullYear() ?? dayPicker.toYear;

  const currentYear = firstDisplayedMonth.getFullYear();
  const canGoPrev = minYear === undefined || currentYear > minYear;
  const canGoNext = maxYear === undefined || currentYear < maxYear;

  const handlePrevYear = () => {
    if (!canGoPrev) return;
    navigation.goToMonth(addYears(currentYearStart, -1));
  };

  const handleNextYear = () => {
    if (!canGoNext) return;
    navigation.goToMonth(addYears(currentYearStart, 1));
  };

  return (
    <div
      className={cn(dayPicker.classNames.months, "flex flex-col gap-4")}
      style={dayPicker.styles.months}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePrevYear}
          disabled={!canGoPrev}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-8 w-8 shrink-0",
            !canGoPrev && "cursor-not-allowed opacity-50"
          )}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-semibold leading-none">
            {currentYear}
          </span>
        </div>
        <button
          type="button"
          onClick={handleNextYear}
          disabled={!canGoNext}
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-8 w-8 shrink-0",
            !canGoNext && "cursor-not-allowed opacity-50"
          )}
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {months.map((month) => (
          <MonthCell key={month.toISOString()} monthDate={month} />
        ))}
      </div>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      captionLayout="dropdown-buttons"
      numberOfMonths={12}
      locale={props.locale ?? ptBR}
      fromYear={new Date().getFullYear() - 10}
      toYear={new Date().getFullYear()}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        ...classNames,
        months: "flex flex-col gap-4",
        nav: "space-x-1 flex items-center justify-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Months: MonthGrid,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
