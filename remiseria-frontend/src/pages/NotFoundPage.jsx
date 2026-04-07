import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-vh-100 d-flex flex-column align-items-center justify-content-center text-center p-4"
      style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FEE2E2 100%)' }}
    >
      <div style={{ fontSize: '5rem' }}>🚖</div>
      <h1 className="fw-bold mt-3" style={{ fontSize: '6rem', color: '#EF4444' }}>
        404
      </h1>
      <h2 className="fw-semibold mb-2 text-dark">Página no encontrada</h2>
      <p className="text-muted mb-4" style={{ maxWidth: '400px' }}>
        La dirección que buscás no existe o fue movida. Volvé al inicio y seguí desde ahí.
      </p>
      <button
        className="btn btn-danger px-4 py-2 fw-bold"
        onClick={() => navigate('/', { replace: true })}
      >
        ← Volver al inicio
      </button>
    </div>
  );
};

export default NotFoundPage;
