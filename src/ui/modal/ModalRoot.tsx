const MODAL_ROOT_ID = 'stones-modal-root';

export function getModalRoot() {
  if (typeof document === 'undefined') {
    return null;
  }

  let root = document.getElementById(MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = MODAL_ROOT_ID;
    document.body.append(root);
  }

  return root;
}
