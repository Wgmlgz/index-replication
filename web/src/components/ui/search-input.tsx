import React from "react";
import { Search } from "lucide-react";
import { Label } from "./label";
import { SidebarGroupContent, SidebarInput } from "./sidebar";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function SearchInput({ className, type, placeholder, ...props }: React.ComponentProps<"input">) {
  return (
    <div className={cn("text-sm relative", className)}>
      <Label htmlFor="search" className="sr-only">
        {placeholder}
      </Label>
      <Input
        placeholder={placeholder}
        className="pl-8"
        {...props}
      />
      <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
    </div>
  );
};