import { useState } from 'react';
import { X } from 'lucide-react';

const TUTORIAL_STORAGE_KEY = 'clarus_tutorial_seen';

const STEPS = [
  {
    title: 'Welcome to the Clarity Checker',
    text: 'This tutorial will walk you through the main features of the tool.',
    image: null,
    video: null,
  },
  {
    title: 'Paste or Type Your Text',
    text: 'Start by typing or pasting the text you want to analyse into the editor area on the left side of the screen. Then click the "Analyse" button.',
    image: null,
    video: '/tutorial/paste-text.mp4',
  },
  {
    title: 'Review Highlighted Phrases',
    text: 'Detected phrases in the text will be underlined. To view the details of why it was highlighted, simply hover over the phrase.',
    image: null,
    video: '/tutorial/hover.mp4',
  },
  {
    title: 'To ignore an item, click ignore in the hover menu',
    text: 'If you don\'t think a detected phrase is relevant to your analysis, you can click the "Ignore" button in the hover menu. This will make the tool ignore the word in the current and future texts you submit.',
    image: null,
    video: '/tutorial/ignore.mp4',
  },
  {
    title: 'Turn off categories in the sidebar',
    text: 'Sometimes, you may want to ignore an entire category of indicators. You can do this by finding it in the sidebar and toggling off the categories that are not relevant to your analysis.',
    image: null,
    video: 'tutorial/turn-off-category.mp4',
  },
  {
    title: 'Manage Categories & Ignore list',
    text: 'You can view and manage your ignored phrases and categories at any time from the header.',
    image: null,
    video: 'tutorial/manage-ignored.mp4',
  },
  {
    title: 'You\'re Ready!',
    text: 'That\'s everything you need to get started, but there\'s plenty more to explore in the tool. You can reopen this tutorial at any time from the About menu in the header.',
    image: null,
    video: null,
  },
];

export const checkShouldShowTutorial = (): boolean => {
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true';
};

export const markTutorialSeen = (): void => {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
};

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal = ({ isOpen, onClose }: TutorialModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleClose = () => {
    markTutorialSeen();
    setCurrentStep(0);
    onClose();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal" role="dialog" aria-modal="true" aria-label="Tutorial">
        <div className="tutorial-header">
          <span className="tutorial-step-label">Step {currentStep + 1} of {STEPS.length}</span>
          <button className="tutorial-close" onClick={handleClose} aria-label="Close tutorial">
            <X size={20} />
          </button>
        </div>

        <div className="tutorial-body">
          <h2 className="tutorial-title">{step.title}</h2>
          <p className="tutorial-text">{step.text}</p>

          {(step.video || step.image) && (
          <div className="tutorial-image-placeholder">
            {step.video ? (
              <video
                key={step.video}
                src={step.video}
                className="tutorial-video"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img src={step.image!} alt={`Tutorial step ${currentStep + 1}`} className="tutorial-image" />
            )}
          </div>
          )}
        </div>

        <div className="tutorial-footer">
          <div className="tutorial-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`tutorial-dot${i === currentStep ? ' tutorial-dot--active' : ''}`}
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="tutorial-nav">
            <button
              className="tutorial-btn tutorial-btn--secondary"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              Back
            </button>
            <button
              className="tutorial-btn tutorial-btn--primary"
              onClick={handleNext}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
