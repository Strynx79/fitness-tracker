"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  /** Form field name; Base UI renders the hidden input that carries the value. */
  name: string;
  id?: string;
  defaultValue?: string;
  options: ReadonlyArray<SelectOption>;
  className?: string;
};

/**
 * A select whose popup is real DOM, not the browser's native list.
 *
 * That is the whole reason this exists: a native `<select>` popup is drawn by the
 * OS/browser and ignores the page's font stack, so the open menu reads in a
 * different typeface from everything around it. Styling our own listbox makes the
 * trigger match `Input` exactly and the options inherit Geist like the rest of
 * the app.
 *
 * The trade-off: the popup needs JavaScript to open (the browser's native list
 * does not). Base UI still renders a hidden input, so a plain GET/POST form
 * submits the value normally once the user has picked something.
 */
export function SelectField({
  name,
  id,
  defaultValue,
  options,
  className,
}: SelectFieldProps) {
  return (
    <SelectPrimitive.Root
      name={name}
      id={id}
      defaultValue={defaultValue}
      items={options}
    >
      <SelectPrimitive.Trigger
        // 48px tall and text-base, matching the inputs it sits beside.
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 data-[popup-open]:bg-muted dark:bg-input/30 flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-1 font-sans text-base transition-colors outline-none focus-visible:ring-3 md:text-sm",
          className,
        )}
      >
        <SelectPrimitive.Value className="truncate text-left" />
        <SelectPrimitive.Icon className="text-muted-foreground shrink-0">
          <ChevronDown aria-hidden className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="z-50">
          <SelectPrimitive.Popup
            className={cn(
              "bg-popover text-popover-foreground",
              // Same type scale as the page; `--anchor-width` keeps the menu at
              // least as wide as the control it drops out of.
              "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border p-1 font-sans text-base shadow-lg outline-none md:text-sm",
            )}
          >
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="data-[highlighted]:bg-muted flex min-h-11 cursor-default items-center justify-between gap-2 rounded-md px-2 py-1.5 outline-none select-none"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check aria-hidden className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
