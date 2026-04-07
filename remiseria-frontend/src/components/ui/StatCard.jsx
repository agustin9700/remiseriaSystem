import Card, { CardBody } from './Card';

const StatCard = ({ label, value, icon, tone = 'neutral' }) => (
  <Card className={`ui-stat-card ui-stat-${tone}`}>
    <CardBody>
      <div className="ui-stat-row">
        <span className="ui-stat-label">{label}</span>
        {icon ? <span className="ui-stat-icon">{icon}</span> : null}
      </div>
      <div className="ui-stat-value">{value}</div>
    </CardBody>
  </Card>
);

export default StatCard;
