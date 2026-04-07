import { cn } from './utils';

const toneMap = {
  success: 'ui-badge-success',
  warning: 'ui-badge-warning',
  info: 'ui-badge-info',
  danger: 'ui-badge-danger',
  neutral: 'ui-badge-neutral',
};

const Badge = ({ children, tone = 'neutral', className }) => (
  <span className={cn('ui-badge', toneMap[tone], className)}>{children}</span>
);

export default Badge;
