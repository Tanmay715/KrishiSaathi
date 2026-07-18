import { useTranslation } from 'react-i18next';
import Modal from './Modal';

function ConfirmDialog({
  title,
  message,
  confirm_label,
  cancel_label,
  is_danger = false,
  is_loading = false,
  on_confirm,
  on_cancel,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      title={title || t('common.confirm')}
      on_close={on_cancel}
      footer={(
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={on_cancel} disabled={is_loading}>
            {cancel_label || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`btn ${is_danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={on_confirm}
            disabled={is_loading}
          >
            {is_loading ? t('common.loading') : (confirm_label || t('common.confirm'))}
          </button>
        </div>
      )}
    >
      <p className="confirm-dialog-message">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
