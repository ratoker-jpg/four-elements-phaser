import type { MatchResultState } from '../../state/types';

export interface MatchResultOverlayCallbacks {
  onRestart: () => void;
  onMainMenu: () => void;
}

export class MatchResultOverlay {
  private root: HTMLDivElement | null = null;

  show(result: MatchResultState, callbacks: MatchResultOverlayCallbacks): void {
    if (result.outcome === 'ongoing' || this.root) return;

    const root = document.createElement('div');
    root.id = 'match-result-overlay';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(6,10,18,.78)', 'backdrop-filter:blur(5px)',
      'font-family:Arial,sans-serif', 'pointer-events:auto',
    ].join(';');

    const panel = document.createElement('section');
    panel.style.cssText = [
      'min-width:360px', 'max-width:560px', 'padding:36px',
      'border:2px solid #d7a94b', 'border-radius:14px',
      'background:linear-gradient(180deg,#242018,#14130f)',
      'box-shadow:0 24px 80px rgba(0,0,0,.65)', 'text-align:center',
      'color:#f6e4b6',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = result.outcome === 'victory' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    title.style.cssText = `margin:0 0 12px;font-size:46px;letter-spacing:4px;color:${result.outcome === 'victory' ? '#78e08f' : '#ff7675'}`;

    const text = document.createElement('p');
    text.textContent = result.outcome === 'victory'
      ? 'Все три вражеских штаба уничтожены.'
      : 'Твой штаб уничтожен.';
    text.style.cssText = 'margin:0 0 28px;font-size:18px;color:#ddd2b8';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;justify-content:center';
    actions.append(
      this.button('Повторить тот же бой', callbacks.onRestart, true),
      this.button('В главное меню', callbacks.onMainMenu, false),
    );
    panel.append(title, text, actions);
    root.append(panel);
    document.body.append(root);
    this.root = root;
  }

  isVisible(): boolean {
    return this.root !== null;
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
  }

  private button(label: string, onClick: () => void, primary: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'padding:12px 18px', 'border-radius:8px', 'cursor:pointer',
      `border:1px solid ${primary ? '#e4bd68' : '#6c6250'}`,
      `background:${primary ? '#8a6427' : '#2b2924'}`,
      'color:#fff3d1', 'font-size:15px', 'font-weight:700',
    ].join(';');
    button.addEventListener('click', onClick, { once: true });
    return button;
  }
}
