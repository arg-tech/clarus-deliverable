let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
let popupLeaveHandler: (() => void) | null = null;

export const setDismissTimeout = (fn: () => void, ms: number) => {
  clearDismissTimeout();
  dismissTimeout = setTimeout(fn, ms);
};

export const clearDismissTimeout = () => {
  if (dismissTimeout !== null) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
};

export const cleanupPopupListener = () => {
  if (popupLeaveHandler) {
    const popup = document.querySelector('.bias-popup');
    if (popup) {
      popup.removeEventListener('mouseleave', popupLeaveHandler);
    }
    popupLeaveHandler = null;
  }
};

export const setPopupLeaveHandler = (handler: () => void) => {
  popupLeaveHandler = handler;
};

export const getPopupLeaveHandler = () => popupLeaveHandler;
