import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonBaseProps {
  /** Visual style. Omit for the neutral DS button. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon rendered before the label. */
  leftIcon?: ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export type ButtonLinkProps = ButtonBaseProps & {
  /** Renders a Next `Link` (or a plain `<a target="_blank">` for http(s) URLs). */
  href: string;
  /** Force external anchor rendering. */
  external?: boolean;
} & Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'className' | 'children'>;

export type ButtonElementProps = ButtonBaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>;

export type ButtonProps = ButtonLinkProps | ButtonElementProps;

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};
const SIZE: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg', xl: 'btn-xl' };

/**
 * DS-style button. Pass `href` to render a Next `Link` with identical styling.
 *
 * @example <Button variant="primary" size="lg" href="/daily">Start daily battle</Button>
 * @example <Button variant="ghost" onClick={reroll} leftIcon={<Icon/>}>Reroll</Button>
 */
export function Button(props: ButtonProps) {
  const { variant, size = 'md', block, loading, leftIcon, rightIcon, className, children } = props;
  const classes = cn('btn', variant && VARIANT[variant], SIZE[size], block && 'w-full', className);
  const content = (
    <>
      {loading ? <SpinnerDot /> : leftIcon}
      {children}
      {rightIcon}
    </>
  );

  if (props.href !== undefined) {
    const { href, external, ...anchorRest } = stripBase(props);
    const isExternal = external ?? /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...anchorRest}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} aria-disabled={loading || undefined} {...anchorRest}>
        {content}
      </Link>
    );
  }

  const { type, disabled, ...buttonRest } = stripBase(props);
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  );
}

/** Removes the style-only props so the rest can be spread onto the DOM element. */
function stripBase<T extends ButtonBaseProps>(props: T): Omit<T, keyof ButtonBaseProps> {
  const { variant, size, block, loading, leftIcon, rightIcon, className, children, ...rest } = props;
  void variant; void size; void block; void loading; void leftIcon; void rightIcon; void className; void children;
  return rest;
}

function SpinnerDot() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}
