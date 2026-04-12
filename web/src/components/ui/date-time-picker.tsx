"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type DateTimePickerProps = {
  idPrefix: string;
  label: string;
  value: Date;
  dateLabel: string;
  timeLabel: string;
  onChange: (nextValue: Date) => void;
};

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function replaceDatePart(base: Date, pickedDate: Date): Date {
  const next = new Date(base);
  next.setFullYear(
    pickedDate.getFullYear(),
    pickedDate.getMonth(),
    pickedDate.getDate()
  );
  return next;
}

function withTime(base: Date, timeValue: string): Date {
  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number.parseInt(hoursRaw ?? "", 10);
  const minutes = Number.parseInt(minutesRaw ?? "", 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return base;
  }

  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function DateTimePicker({
  idPrefix,
  label,
  value,
  dateLabel,
  timeLabel,
  onChange,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const dateButtonLabel = isValidDate(value) ? format(value, "PPP") : dateLabel;
  const timeValue = isValidDate(value) ? format(value, "HH:mm") : "00:00";

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`${idPrefix}-date`}
              type="button"
              variant="outline"
              className="justify-between font-normal"
            >
              {dateButtonLabel}
              <ChevronDownIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              captionLayout="dropdown"
              defaultMonth={value}
              onSelect={nextDate => {
                if (!nextDate) {
                  return;
                }
                onChange(replaceDatePart(value, nextDate));
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Input
          id={`${idPrefix}-time`}
          type="time"
          value={timeValue}
          onChange={event => onChange(withTime(value, event.target.value))}
          step={60}
          className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  );
}
