import { cn } from './utils';

const Table = ({ className, children }) => (
  <div className="ui-table-wrap">
    <table className={cn('ui-table', className)}>{children}</table>
  </div>
);

export default Table;
