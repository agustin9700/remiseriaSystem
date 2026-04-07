import { cn } from './utils';

const PageHeader = ({ title, subtitle, actions, className }) => (
  <div className={cn('ui-page-header', className)}>
    <div>
      <h1 className="ui-page-title">{title}</h1>
      {subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}
    </div>
    {actions ? <div className="ui-page-actions">{actions}</div> : null}
  </div>
);

export default PageHeader;
