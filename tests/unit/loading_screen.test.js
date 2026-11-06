import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertFalse, assertTrue } from '../helpers/assert.js';
import { LoadingScreen } from '../../src/ui/loading_screen.js';

function fakeImage() {
  const listeners = new Map();
  return {
    complete: false, naturalWidth: 0, src: '', dataset: {},
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    emit(type) { listeners.get(type)?.(); },
    listenerCount() { return listeners.size; },
    decode: async () => {}
  };
}

describe('Promotional loading screen readiness', () => {
  it('waits for the promotional artwork and real sprite preparation before enabling entry', async () => {
    const screen = new LoadingScreen();
    let finishArtwork;
    screen.artworkReady = new Promise(resolve => { finishArtwork = resolve; });
    screen.preloadSprites = async callback => callback({ loaded: 4, total: 4, percent: 100, key: 'last' });
    screen.minDisplayMs = 0;
    screen.updateProgressUI = () => {};
    const pending = screen.startLoadingSequence();
    await new Promise(resolve => setTimeout(resolve, 0));
    assertFalse(screen.isReady);
    finishArtwork(true);
    await pending;
    assertTrue(screen.isReady);
  });

  it('falls back after image failure and completes only after the fallback is decoded', async () => {
    const screen = new LoadingScreen();
    const image = fakeImage();
    let decode;
    image.decode = () => new Promise(resolve => { decode = resolve; });
    const pending = screen.loadArtwork(image);
    image.emit('error');
    assertEqual(image.src, 'assets/ui/splash_heroes.png');
    image.naturalWidth = 1536;
    image.emit('load');
    assertFalse(screen.isReady);
    decode();
    assertTrue(await pending);
    assertEqual(image.dataset.artworkState, 'fallback');
    assertEqual(image.listenerCount(), 0);
  });

  it('allows entry when both image requests fail and clears image listeners', async () => {
    const screen = new LoadingScreen();
    const image = fakeImage();
    const pending = screen.loadArtwork(image);
    image.emit('error');
    image.emit('error');
    assertFalse(await pending);
    assertEqual(image.dataset.artworkState, 'unavailable');
    assertEqual(image.listenerCount(), 0);
  });

  it('does not transition before ready and runs completion only once', () => {
    let completed = 0;
    const screen = new LoadingScreen({ onComplete: () => { completed++; } });
    screen.proceedToSelection();
    assertEqual(completed, 0);
    screen.isReady = true;
    screen.proceedToSelection();
    screen.proceedToSelection();
    assertEqual(completed, 1);
  });

  it('bounds artwork failure time instead of holding the loading screen indefinitely', async () => {
    const screen = new LoadingScreen();
    const image = fakeImage();
    assertFalse(await screen.loadArtwork(image, { timeoutMs: 1 }));
    assertEqual(image.src, 'assets/ui/splash_heroes.png');
    assertEqual(image.listenerCount(), 0);
  });

  it('keeps native controls in charge of Enter and Space and accepts a ready background shortcut once', () => {
    let completed = 0;
    let prevented = 0;
    const screen = new LoadingScreen({ onComplete: () => { completed++; } });
    const event = { key: ' ', target: { tagName: 'BODY' }, preventDefault() { prevented++; } };
    screen.handleKeyDown(event);
    assertEqual(completed, 0);
    screen.isReady = true;
    screen.handleKeyDown({ ...event, target: { tagName: 'BUTTON' } });
    screen.handleKeyDown({ ...event, target: { tagName: 'INPUT' } });
    screen.handleKeyDown({ ...event, repeat: true });
    assertEqual(completed, 0);
    screen.handleKeyDown(event);
    screen.handleKeyDown(event);
    assertEqual(completed, 1);
    assertEqual(prevented, 1);
  });

  it('cancels pending artwork and delayed tips when a splash is destroyed', async () => {
    const screen = new LoadingScreen();
    const image = fakeImage();
    let delayed = 0;
    screen.schedule(() => { delayed++; }, 1);
    const pending = screen.loadArtwork(image);
    screen.destroy();
    assertFalse(await pending);
    assertEqual(screen.timeouts.size, 0);
    assertEqual(image.listenerCount(), 0);
    await new Promise(resolve => setTimeout(resolve, 5));
    assertEqual(delayed, 0);
  });

  it('does not label the arena ready while sprites completed but artwork is still pending', () => {
    const screen = new LoadingScreen();
    const label = { textContent: '' };
    screen.container = { querySelector: id => id === '#loading-asset-label' ? label : null };
    screen.updateProgressUI(95, 'complete', 58, 58);
    assertEqual(label.textContent, 'Finalizando a arte da arena...');
    screen.updateProgressUI(100, 'complete', 58, 58);
    assertEqual(label.textContent, 'Arena pronta para a batalha');
  });
});
