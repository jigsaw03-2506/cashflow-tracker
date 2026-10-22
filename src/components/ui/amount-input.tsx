"use client";

import { useRef, useState, type ComponentProps } from "react";
import {
  amountToText,
  caretAfterFormat,
  formatAmountText,
  parseAmountText,
} from "@/lib/amount-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "ref"> & {
  value?: number;
  onChange: (value: number) => void;
  /** Value reported when the field is empty: NaN (required amounts) or 0 (balances). */
  emptyValue?: number;
  ref?: (element: HTMLInputElement | null) => void;
};

/**
 * Money input that groups digits with commas as you type (1,000,000.23).
 * It is a text field, so the scroll wheel and arrow keys never change the amount.
 */
export function AmountInput({ value, onChange, emptyValue = Number.NaN, ref, ...props }: AmountInputProps) {
  const [text, setText] = useState(() => amountToText(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Input
      {...props}
      ref={(element) => {
        inputRef.current = element;
        ref?.(element);
      }}
      // A line height that fits the Myanmar font, so the wheel cannot scroll the text inside the box.
      className={cn("number h-10 py-0 leading-normal", props.className)}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={props.placeholder ?? "0"}
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        const caret = event.target.selectionStart ?? raw.length;
        const formatted = formatAmountText(raw);
        setText(formatted);
        onChange(parseAmountText(formatted, emptyValue));
        const position = caretAfterFormat(raw, caret, formatted);
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position));
      }}
    />
  );
}
