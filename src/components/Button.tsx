import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

/** Shared visual states; callers explicitly choose submit semantics. */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'secondary', className = '', type = 'button', ...props }, ref) => (
        <button ref={ref} type={type} className={`ui-button ui-button--${variant} ${className}`} {...props} />
    )
);
Button.displayName = 'Button';
export default Button;
