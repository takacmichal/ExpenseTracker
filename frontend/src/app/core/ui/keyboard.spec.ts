import { shouldIgnoreShortcut } from './keyboard';

/** Dispatches a keydown on the target and returns the decision made for it. */
function decide(target: EventTarget, init: KeyboardEventInit = {}): boolean {
  let result: boolean | undefined;
  const listener = (event: Event) => (result = shouldIgnoreShortcut(event as KeyboardEvent));
  document.addEventListener('keydown', listener);
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, ...init }));
  document.removeEventListener('keydown', listener);
  return result!;
}

describe('shouldIgnoreShortcut', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('allows a plain key on a non-editable element', () => {
    expect(decide(host)).toBe(false);
  });

  it('allows a plain key dispatched on the document', () => {
    expect(decide(document)).toBe(false);
  });

  it.each<[string, KeyboardEventInit]>([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['alt', { altKey: true }],
    ['repeat', { repeat: true }],
  ])('ignores the key when %s is set', (_, init) => {
    expect(decide(host, init)).toBe(true);
  });

  it('does not ignore shift alone', () => {
    expect(decide(host, { shiftKey: true })).toBe(false);
  });

  it.each(['input', 'textarea', 'select'])('ignores keys typed into a <%s>', (tag) => {
    const field = document.createElement(tag);
    host.appendChild(field);
    expect(decide(field)).toBe(true);
  });

  it('ignores keys from inside a combobox', () => {
    host.innerHTML = '<div role="combobox"><span id="inner">x</span></div>';
    expect(decide(host.querySelector('#inner')!)).toBe(true);
  });

  it('ignores keys in a contenteditable element', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not implement isContentEditable; emulate what the browser reports.
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    host.appendChild(editable);
    expect(decide(editable)).toBe(true);
  });

  it.each(['p-dialog-mask', 'p-drawer-mask', 'p-overlay-mask'])(
    'ignores keys while a .%s overlay is open',
    (cls) => {
      const mask = document.createElement('div');
      mask.className = cls;
      document.body.appendChild(mask);
      expect(decide(host)).toBe(true);
    },
  );
});
