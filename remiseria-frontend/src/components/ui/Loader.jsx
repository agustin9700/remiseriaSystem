const Loader = ({ label = 'Cargando...' }) => (
  <div className="ui-loader-wrap">
    <span className="ui-loader" />
    <span>{label}</span>
  </div>
);

export const Skeleton = ({ height = 14 }) => (
  <div className="ui-skeleton" style={{ height }} />
);

export default Loader;
