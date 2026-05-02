import type { DbcInfo, MessageInfo } from '../../types';
import { renderDbcMessagesHtml, renderDbcSignalsHtml, getDbcMessageSubtitle } from '../../renderers';

/** DBC Viewer component */
export class DbcViewerElement extends HTMLElement {
  private dbcInfo: DbcInfo | null = null;
  private selectedMessageId: number | null = null;

  constructor() {
    super();
  }

  /** Set DBC info and render */
  setDbcInfo(info: DbcInfo | null): void {
    this.dbcInfo = info;
    this.selectedMessageId = null;
    this.render();
  }

  private render(): void {
    this.renderMessagesList();
    this.renderDetails();
  }

  private renderMessagesList(): void {
    const list = this.querySelector('.cv-card-body');
    if (!list) return;

    list.innerHTML = renderDbcMessagesHtml(this.dbcInfo, this.selectedMessageId);
    this.bindMessageEvents(list);
  }

  private bindMessageEvents(list: Element): void {
    list.querySelectorAll('.cv-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt((item as HTMLElement).dataset.id || '0');
        this.selectMessage(id);
      });
    });
  }

  private selectMessage(messageId: number): void {
    this.selectedMessageId = messageId;
    this.render();

    const msg = this.getSelectedMessage();
    if (msg) {
      this.dispatchEvent(new CustomEvent('message-selected', {
        detail: { message: msg },
        bubbles: true,
      }));
    }
  }

  private getSelectedMessage(): MessageInfo | null {
    if (this.selectedMessageId === null || !this.dbcInfo?.messages) return null;
    return this.dbcInfo.messages.find(m => m.id === this.selectedMessageId) || null;
  }

  private renderDetails(): void {
    const title = this.querySelector('.cv-detail-title');
    const subtitle = this.querySelector('.cv-detail-subtitle');
    const content = this.querySelector('.cv-card-body.padded');

    const msg = this.getSelectedMessage();

    if (!msg) {
      if (title) title.textContent = 'Select a message';
      if (subtitle) subtitle.textContent = '';
      if (content) content.innerHTML = '<div class="cv-empty">Select a message to view its signals</div>';
      return;
    }

    if (title) title.textContent = msg.name;
    if (subtitle) subtitle.textContent = getDbcMessageSubtitle(msg);
    if (content) content.innerHTML = renderDbcSignalsHtml(msg);
  }
}

customElements.define('cv-dbc-viewer', DbcViewerElement);
