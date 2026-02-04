import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";
import moment from "moment";

export type TimeProps = {
  time: string | undefined | null
  className?: string,
  fallback?: string
};

export function Time({ className, time, fallback = '-' }: TimeProps) {
  return (
    <>
      {time ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className={cn('inline', className)}>
              {moment(time).fromNow()}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p> {moment(time).format('lll')}</p>
          </TooltipContent>
        </Tooltip >
      ) : fallback}
    </>
  );
}
