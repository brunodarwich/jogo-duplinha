import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertFalse, assertTrue } from '../helpers/assert.js';
import { LobbyUI } from '../../src/ui/lobby_ui.js';

function element() {
  return { textContent: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} } };
}

describe('Lobby lifecycle', () => {
  it('A failed host registration keeps Start disabled and explains the failure', async () => {
    const previousDocument = globalThis.document;
    const elements = { 'host-status': element(), 'start-game-btn': element() };
    globalThis.document = { getElementById: id => elements[id] || null };
    try {
      const lobby = Object.create(LobbyUI.prototype);
      Object.assign(lobby, { selectedMode: 'host', selectedHeroId: 'knight', roomCode: 'ABCD', connectionGeneration: 0,
        network: { hostRoom: async () => { throw new Error('Sinalização indisponível'); }, disconnect() {} } });
      await lobby.initHostSession();
      assertFalse(lobby.hostReady);
      assertTrue(elements['start-game-btn'].disabled);
      assertTrue(elements['host-status'].textContent.includes('Sinalização indisponível'));
    } finally {
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });

  it('Changing mode disconnects the previous room and restores lobby callbacks', () => {
    const previousDocument = globalThis.document;
    globalThis.document = { getElementById: () => element() };
    try {
      let disconnects = 0;
      const lobby = Object.create(LobbyUI.prototype);
      Object.assign(lobby, { selectedMode: 'host', connectionGeneration: 1, isClientConnected: true,
        container: { querySelectorAll: () => [] }, network: { disconnect() { disconnects++; } } });
      lobby.updateModeUI('solo');
      assertEqual(disconnects, 1);
      assertFalse(lobby.isClientConnected);
      assertEqual(typeof lobby.network.onRosterChangeCallback, 'function');
      assertEqual(typeof lobby.network.onMatchStartCallback, 'function');
    } finally {
      if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    }
  });
});
