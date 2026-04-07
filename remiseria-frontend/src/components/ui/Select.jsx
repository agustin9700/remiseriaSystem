import { cn } from './utils';

const Select = ({ className, children, ...props }) => (
  <select className={cn('ui-select', className)} {...props}>
    {children}
  </select>
);

export default Select;
