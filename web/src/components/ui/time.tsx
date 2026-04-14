"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";
import moment from "moment";
import { useTranslation } from "react-i18next";

export type TimeProps = {
  time: string | undefined | null
  className?: string,
  fallback?: string
};

export function Time({ className, time, fallback = '-' }: TimeProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";

  return (
    <>
      {time ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className={cn('inline', className)}>
              {moment(time).locale(locale).fromNow()}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p> {moment(time).locale(locale).format('lll')}</p>
          </TooltipContent>
        </Tooltip >
      ) : fallback}
    </>
  );
}
