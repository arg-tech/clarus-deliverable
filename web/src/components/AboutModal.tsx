import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTutorial: () => void;
}

export const AboutModal = ({ isOpen, onClose, onOpenTutorial }: AboutModalProps) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleOpenTutorial = () => {
    onClose();
    onOpenTutorial();
  };

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        <div className="about-modal-header">
          <h2 className="about-modal-title">{t('about.title')}</h2>
          <button className="about-modal-close" onClick={onClose} aria-label={t('about.close')}>
            <X size={22} />
          </button>
        </div>
        <div className="about-modal-body">
          <section className="about-section">
            <h3 className="about-section-title">{t('about.limitations.title')}</h3>
            <p className="about-section-text">{t('about.limitations.text')}</p>
          </section>
          <section className="about-section">
            <h3 className="about-section-title">{t('about.privacy.title')}</h3>
            <p className="about-section-text">{t('about.privacy.text')}</p>
          </section>
          <section className="about-section">
            <h3 className="about-section-title">{t('about.logging.title')}</h3>
            <p className="about-section-text">{t('about.logging.text')}</p>
          </section>
        </div>
        <div className="about-modal-footer">
          <button className="about-tutorial-button" onClick={handleOpenTutorial}>
            Open Tutorial
          </button>
        </div>
      </div>
    </div>
  );
};
