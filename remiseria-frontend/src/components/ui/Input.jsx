import { cn } from './utils';

const Input = ({ className, ...props }) => (
  <input className={cn('ui-input', className)} {...props} />
);

export default Input;
