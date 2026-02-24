"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"]
type ButtonSize = VariantProps<typeof buttonVariants>["size"]

type ButtonToggleGroupOption<TValue extends string> = {
  value: TValue
  label: string
  content: React.ReactNode
  disabled?: boolean
}

type ButtonToggleGroupSelectOption<TValue extends string> = {
  value: TValue
  label: string
}

type ButtonToggleGroupSelect<TValue extends string> = {
  value?: TValue
  placeholder: string
  options: readonly ButtonToggleGroupSelectOption<TValue>[]
  onValueChange: (value: TValue) => void
  variant?: "outline" | "default" | "secondary"
  triggerClassName?: string
  contentClassName?: string
}

type ButtonToggleGroupProps<TValue extends string> = {
  value: TValue
  options: readonly ButtonToggleGroupOption<TValue>[]
  onValueChange: (value: TValue) => void
  size?: ButtonSize
  activeVariant?: ButtonVariant
  inactiveVariant?: ButtonVariant
  select?: ButtonToggleGroupSelect<TValue>
  groupClassName?: string
  buttonClassName?: string
}

function ButtonToggleGroup<TValue extends string>({
  value,
  options,
  onValueChange,
  size = "icon",
  activeVariant = "default",
  inactiveVariant = "secondary",
  select,
  groupClassName,
  buttonClassName ='w-auto h-7 px-2 text-xs',
}: ButtonToggleGroupProps<TValue>) {
  const resolveSelectVariant = (
    variant: ButtonVariant
  ): "outline" | "default" | "secondary" => {
    if (variant === "default" || variant === "secondary" || variant === "outline") {
      return variant
    }
    return "outline"
  }
  const isSelectOptionActive = Boolean(
    select?.options.some(option => option.value === value)
  )
  const selectVariant =
    select?.variant ??
    resolveSelectVariant(isSelectOptionActive ? activeVariant : inactiveVariant)
  const buttons = options.map(option => {
    const isSelected = value === option.value
    return (
      <Button
        key={option.value}
        type="button"
        size={size}
        className={buttonClassName}
        variant={isSelected ? activeVariant : inactiveVariant}
        onClick={() => onValueChange(option.value)}
        aria-pressed={isSelected}
        aria-label={option.label}
        title={option.label}
        disabled={option.disabled}
      >
        {option.content}
      </Button>
    )
  })

  return (
    <ButtonGroup className={groupClassName}>
      {buttons}
      {select ? (
        <Select
          value={select.value}
          onValueChange={value => select.onValueChange(value as TValue)}
        >
          <SelectTrigger
            size="sm"
            variant={selectVariant}
            className={cn(size === "icon" ? "h-7 text-xs" : undefined, select.triggerClassName)}
          >
            <SelectValue placeholder={select.placeholder} />
          </SelectTrigger>
          <SelectContent className={select.contentClassName}>
            {select.options.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </ButtonGroup>
  )
}

export { ButtonToggleGroup }
export type { ButtonToggleGroupOption, ButtonToggleGroupSelectOption }
