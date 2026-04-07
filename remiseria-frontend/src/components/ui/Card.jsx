import { cn } from './utils';

const Card = ({ children, className }) => (
  <section className={cn('ui-card', className)}>{children}</section>
);

export const CardHeader = ({ children, className }) => (
  <header className={cn('ui-card-header', className)}>{children}</header>
);

export const CardBody = ({ children, className }) => (
  <div className={cn('ui-card-body', className)}>{children}</div>
);

export default Card;
