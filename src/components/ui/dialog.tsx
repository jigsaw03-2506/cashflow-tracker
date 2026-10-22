"use client";

import * as Primitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <Primitive.Content
        className={cn(
          "fixed left-4 right-4 top-1/2 z-50 max-h-screen w-auto -translate-y-1/2 overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-floating focus:outline-none sm:left-1/2 sm:right-auto sm:w-full sm:max-w-xl sm:-translate-x-1/2",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close className="absolute right-4 top-4 rounded-control p-2 text-muted transition-colors hover:bg-surface-subtle hover:text-ink">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("mb-5 pr-10", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn("text-lg font-semibold text-ink", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn("mt-1 text-sm leading-6 text-muted", className)}
      {...props}
    />
  );
}
