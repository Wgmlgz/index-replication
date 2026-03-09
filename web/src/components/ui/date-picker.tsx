"use client";

import * as React from "react";
import type { Matcher } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DatePickerProps = {
  id?: string;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  size?: React.ComponentProps<typeof Button>["size"];
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateValue(value?: string): Date | undefined {
  if (!value || !ISO_DATE_PATTERN.test(value)) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function DatePicker({
  id,
  value,
  onValueChange,
  placeholder,
  min,
  max,
  disabled,
  className,
  size = "default",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => parseDateValue(value), [value]);
  const minDate = React.useMemo(() => parseDateValue(min), [min]);
  const maxDate = React.useMemo(() => parseDateValue(max), [max]);

  const disabledDays = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, maxDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size={size}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            size === "sm" && "text-xs",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4" />
          {selectedDate ? format(selectedDate, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          selected={selectedDate}
          onSelect={nextDate => {
            if (!nextDate) return;
            onValueChange(format(nextDate, "yyyy-MM-dd"));
            setOpen(false);
          }}
          disabled={disabledDays}
          fromDate={minDate}
          toDate={maxDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
