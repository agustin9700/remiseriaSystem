import { cn } from './utils';

const Tabs = ({ items, value, onChange, className }) => (
  <div className={cn('ui-tabs', className)}>
    {items.map((item) => (
      <button
        key={item.value}
        type="button"
        className={cn('ui-tab', value === item.value && 'ui-tab-active')}
        onClick={() => onChange(item.value)}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default Tabs;
