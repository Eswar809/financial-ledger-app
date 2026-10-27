import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Minimal, dependency-free implementation of the shadcn `input-group`
 * component. The watermelon registry mirror does not carry it, and
 * ui.shadcn.com is unreachable from this environment, so we vendor the API
 * surface actually used by the Bionis dashboard topbar:
 * InputGroup, InputGroupAddon, InputGroupInput.
 */
function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'group/input-group flex w-full min-w-0 items-center overflow-hidden rounded-xl border bg-transparent text-sm transition-[color,box-shadow] has-[[data-input-group-control]:focus-visible]:ring-2 has-[[data-input-group-control]:focus-visible]:ring-ring/50 has-[[data-input-group-control]:focus-visible]:border-ring',
        className,
      )}
      {...props}
    />
  )
}

function InputGroupAddon({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="input-group-addon"
      className={cn('flex items-center pr-2 pl-3 text-muted-foreground', className)}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ref,
  ...props
}: React.ComponentProps<'input'> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      data-input-group-control=""
      data-slot="input-group-input"
      className={cn(
        'min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupInput, Slot }
