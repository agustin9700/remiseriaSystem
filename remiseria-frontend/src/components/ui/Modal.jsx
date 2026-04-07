import { Modal as BootstrapModal } from 'react-bootstrap';

const Modal = ({ children, ...props }) => <BootstrapModal {...props}>{children}</BootstrapModal>;

export const ModalHeader = BootstrapModal.Header;
export const ModalTitle = BootstrapModal.Title;
export const ModalBody = BootstrapModal.Body;
export const ModalFooter = BootstrapModal.Footer;

export default Modal;
