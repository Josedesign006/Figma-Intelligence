import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './Button.module.css';

export type ButtonType = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual hierarchy variant */
  variant?: ButtonType;
  /** Dimensional preset controlling height, padding, font-size */
  size?: ButtonSize;
  /** Button label text */
  children: React.ReactNode;
  /** Show leading icon (arrow) */
  leadingIcon?: boolean;
  /** Show trailing icon (arrow) */
  trailingIcon?: boolean;
  /** Loading state — replaces label with spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'sm',
      children,
      leadingIcon = true,
      trailingIcon = false,
      loading = false,
      fullWidth = false,
      disabled = false,
      className,
      ...rest
    },
    ref
  ) => {
    const classNames = [
      styles.button,
      styles[`variant-${variant}`],
      styles[`size-${size}`],
      fullWidth ? styles.fullWidth : '',
      disabled ? styles.disabled : '',
      loading ? styles.loading : '',
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={disabled || loading}
        {...rest}
      >
        {leadingIcon && !loading && (
          <svg
            className={styles.icon}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8.5 3L13.5 8L8.5 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13 8H3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
        {loading && (
          <svg
            className={`${styles.icon} ${styles.spinner}`}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="28"
              strokeDashoffset="8"
              strokeLinecap="round"
            />
          </svg>
        )}
        <span className={styles.label}>{children}</span>
        {trailingIcon && !loading && (
          <svg
            className={styles.icon}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8.5 3L13.5 8L8.5 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13 8H3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
