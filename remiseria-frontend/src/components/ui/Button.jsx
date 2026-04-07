import { cn } from './utils';

const variantMap = {
  primary: 'ui-btn-primary',
  secondary: 'ui-btn-secondary',
  ghost: 'ui-btn-ghost',
  danger: 'ui-btn-danger',
};

const sizeMap = {
  sm: 'ui-btn-sm',
  md: 'ui-btn-md',
  lg: 'ui-btn-lg',
};

const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  ...props
}) => (
  <button
    type={type}
    className={cn(
      'ui-btn',
      variantMap[variant],
      sizeMap[size],
      loading && 'ui-btn-loading',
      className
    )}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <span className="ui-btn-text">{children}</span> : children}
  </button>
);

export default Button;
