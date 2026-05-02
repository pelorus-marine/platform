import { renderInterfaceOptions } from '../../renderers';

/** Capture controls component */
export class CaptureControlsElement extends HTMLElement {
  private isCapturing = false;

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.bindEvents();
  }

  private bindEvents(): void {
    const startBtn = this.querySelector('#startCaptureBtn');
    const stopBtn = this.querySelector('#stopCaptureBtn');
    const select = this.querySelector('#interfaceSelect');

    startBtn?.addEventListener('click', () => {
      const iface = this.getSelectedInterface();
      if (iface) {
        this.dispatchEvent(new CustomEvent('start-capture', {
          detail: { interface: iface },
          bubbles: true,
        }));
      }
    });

    stopBtn?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('stop-capture', { bubbles: true }));
    });

    select?.addEventListener('change', () => this.updateButtons());

    const refreshBtn = this.querySelector('#refreshInterfacesBtn');
    refreshBtn?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('refresh-interfaces', { bubbles: true }));
    });
  }

  /** Set available interfaces */
  setInterfaces(interfaces: string[]): void {
    const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
    if (select) select.innerHTML = renderInterfaceOptions(interfaces);
    this.updateButtons();
  }

  /** Get currently selected interface */
  getSelectedInterface(): string {
    const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
    return select?.value || '';
  }

  /** Update capture status UI */
  setCaptureStatus(capturing: boolean): void {
    this.isCapturing = capturing;

    const dot = this.querySelector('#statusDot');
    const text = this.querySelector('#statusText');
    const stopBtn = this.querySelector('#stopCaptureBtn') as HTMLButtonElement;

    dot?.classList.toggle('active', capturing);
    if (text) text.textContent = capturing ? 'Capturing...' : 'Idle';
    if (stopBtn) stopBtn.disabled = !capturing;

    this.updateButtons();
  }

  private updateButtons(): void {
    const select = this.querySelector('#interfaceSelect') as HTMLSelectElement;
    const startBtn = this.querySelector('#startCaptureBtn') as HTMLButtonElement;

    if (startBtn && select) {
      startBtn.disabled = !select.value || this.isCapturing;
    }
  }
}

customElements.define('cv-capture-controls', CaptureControlsElement);
