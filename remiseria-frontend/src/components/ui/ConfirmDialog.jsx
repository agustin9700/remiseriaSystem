import React from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle } from '../ui';

const ConfirmDialog = ({
  show,
  onHide,
  onConfirm,
  title = 'Confirmar acción',
  message,
  confirmText = 'Confirmar',
  variant = 'primary'
}) => {
  if (!show) return null;

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <ModalHeader closeButton>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <p>{message}</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button variant={variant} onClick={() => { onConfirm(); onHide(); }}>
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmDialog;