import React, { createContext, useContext, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faInfo, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="ui-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast-${t.type}`}>
            <span className="ui-toast-icon">
              <FontAwesomeIcon icon={
                t.type === 'success' ? faCheck :
                t.type === 'error' ? faTimes :
                t.type === 'warning' ? faExclamationTriangle :
                faInfo
              } />
            </span>
            <span className="ui-toast-message">{t.message}</span>
            <button
              type="button"
              className="ui-toast-close"
              onClick={() => removeToast(t.id)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export default ToastProvider;