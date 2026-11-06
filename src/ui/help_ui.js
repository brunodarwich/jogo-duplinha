const GUIDE_KEY = 'duplinha-guide-seen';
const MOTION_KEY = 'duplinha-reduced-motion';

export const HELP_STEPS = [
  { title: 'Avance com sua equipe', body: 'Derrube a torre externa, depois a interna e destrua o Nexus inimigo. O chefe protege a área, mas não precisa morrer para que um Nexus vulnerável seja destruído.',
    keyboard: 'Botão direito: mover ou atacar. Espaço: voltar a câmera ao herói.',
    touch: 'Arraste no lado esquerdo para andar. Toque em ATACAR perto de um inimigo.' },
  { title: 'Aprenda e mire suas habilidades', body: 'Use os botões + para gastar pontos de habilidade. Q, W e E ficam mais fortes ao evoluir; R precisa ser desbloqueada. Vida, mana e recarga aparecem no painel inferior.',
    keyboard: 'Q / W / E / R: mirar com assistência. Clique ou repita a tecla para lançar; Shift + tecla lança direto. Habilidades próprias são imediatas. Esc cancela.',
    touch: 'Toque para lançar no alvo próximo. Arraste do botão para mirar e solte para lançar; volte ao botão para cancelar. Curas priorizam aliados feridos.' },
  { title: 'Prepare-se na base', body: 'Abra a Loja para comprar equipamentos com seu ouro. Compras e vendas exigem estar perto da fonte. B retorna à base após 5 segundos; mover ou receber dano interrompe o retorno.',
    keyboard: 'P: abrir a Loja. B: retornar à base. M: alternar áudio.',
    touch: 'Use o botão Loja e toque em B para retornar. O minimapa ajuda a acompanhar a trilha.' }
];

function readPreference(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function storePreference(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* Preferences are optional in private/offline contexts. */ }
}

export function resolveReducedMotion(saved, systemPreference) {
  return saved === 'true' || (saved !== 'false' && !!systemPreference);
}

export class HelpUI {
  constructor(gameSim) {
    this.gameSim = gameSim;
    this.step = 0;
    this.previousFocus = null;
    this.dialog = null;
    this.listeners = [];
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this.media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.savedMotion = readPreference(MOTION_KEY);
    this.setReducedMotion(resolveReducedMotion(this.savedMotion, this.media?.matches), false);
    this.createDialog();
    this.listen(document.getElementById('btn-help'), 'click', () => this.open());
    if (this.media?.addEventListener) {
      this.listen(this.media, 'change', e => {
        if (this.savedMotion === null) this.setReducedMotion(e.matches, false);
      });
    }
  }

  listen(target, event, handler) {
    if (!target) return;
    target.addEventListener(event, handler);
    this.listeners.push(() => target.removeEventListener(event, handler));
  }

  createDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'help-overlay';
    dialog.className = 'help-dialog';
    dialog.setAttribute('aria-labelledby', 'help-title');
    dialog.innerHTML = [
      '<header class="help-heading"><span>GUIA DE CAMPO</span><button type="button" class="help-close" aria-label="Fechar guia">×</button></header>',
      '<div class="help-progress" aria-label="Etapa do guia"></div>',
      '<h2 id="help-title"></h2><p class="help-body"></p>',
      '<p class="help-controls"></p><p class="help-running">A partida continua enquanto o guia está aberto.</p>',
      '<label class="motion-preference"><input type="checkbox" id="reduce-motion"> Reduzir movimento e tremor da câmera</label>',
      '<footer class="help-actions"><button type="button" class="help-skip">Pular guia</button><button type="button" class="help-next">Próximo</button></footer>'
    ].join('');
    document.body.appendChild(dialog);
    this.dialog = dialog;
    this.listen(dialog.querySelector('.help-close'), 'click', () => this.close());
    this.listen(dialog.querySelector('.help-skip'), 'click', () => this.close());
    this.listen(dialog.querySelector('.help-next'), 'click', () => {
      if (this.step < HELP_STEPS.length - 1) { this.step++; this.render(); }
      else this.close();
    });
    this.listen(dialog, 'cancel', event => { event.preventDefault(); this.close(); });
    this.listen(dialog.querySelector('#reduce-motion'), 'change', event => this.setReducedMotion(event.target.checked));
    this.render();
  }

  setReducedMotion(enabled, persist = true) {
    this.reducedMotion = !!enabled;
    this.gameSim.camera?.setShakeEnabled?.(!enabled);
    if (this.gameSim.renderer) this.gameSim.renderer.reducedMotion = !!enabled;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('reduced-motion', !!enabled);
      document.documentElement.classList.toggle('motion-allowed', !enabled);
      const checkbox = this.dialog?.querySelector('#reduce-motion');
      if (checkbox) checkbox.checked = !!enabled;
      const settingsCheckbox = document.getElementById('settings-reduce-motion');
      if (settingsCheckbox) settingsCheckbox.checked = !!enabled;
    }
    if (persist) {
      this.savedMotion = String(!!enabled);
      storePreference(MOTION_KEY, this.savedMotion);
    }
  }

  render() {
    if (!this.dialog) return;
    const step = HELP_STEPS[this.step];
    this.dialog.querySelector('.help-progress').textContent = (this.step + 1) + ' / ' + HELP_STEPS.length;
    this.dialog.querySelector('#help-title').textContent = step.title;
    this.dialog.querySelector('.help-body').textContent = step.body;
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    this.dialog.querySelector('.help-controls').textContent = touch ? step.touch : step.keyboard;
    this.dialog.querySelector('.help-next').textContent = this.step === HELP_STEPS.length - 1 ? 'Jogar' : 'Próximo';
    this.dialog.querySelector('#reduce-motion').checked = this.reducedMotion;
  }

  showFirstRun() {
    if (typeof window !== 'undefined' && readPreference(GUIDE_KEY) !== 'true') this.open();
  }

  open() {
    if (!this.dialog || this.dialog.open) return;
    this.gameSim.virtualJoystick?.cancelMovement();
    document.querySelectorAll('.hud-info-panel, .hud-settings-panel').forEach(panel => { panel.open = false; });
    this.previousFocus = document.activeElement;
    this.step = 0;
    this.render();
    this.dialog.showModal();
    this.dialog.querySelector('.help-next').focus();
  }

  close() {
    if (!this.dialog?.open) return;
    this.dialog.close();
    storePreference(GUIDE_KEY, 'true');
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  destroy() {
    this.listeners.forEach(remove => remove());
    this.listeners = [];
    this.dialog?.remove();
  }
}
