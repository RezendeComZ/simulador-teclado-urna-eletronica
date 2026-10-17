/**
 * SIMULADOR DO TECLADO DA URNA ELETRÔNICA
 * Áudio sintetizado via Web Audio API, suporte tátil, teclado físico e responsivo.
 */

(() => {
  'use strict';

  // ----------------------------------------------------
  // ESTADO E CONFIGURAÇÃO DE ÁUDIO
  // ----------------------------------------------------
  let audioCtx = null;
  let somHabilitado = true;

  // Inicializa ou resume o AudioContext (exigência dos navegadores modernos)
  function obterAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Toca um bipe simples para teclas numéricas, BRANCO e CORRIGE
   */
  function tocarBeepTecla() {
    if (!somHabilitado) return;
    const ctx = obterAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Tipo square com filtro para emular o buzzer característico da urna
      osc.type = 'square';
      osc.frequency.setValueAtTime(1250, ctx.currentTime);

      // Controle de envelope rápido (evita estalos digitais)
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.055);
    } catch (e) {
      console.warn('Erro ao reproduzir áudio:', e);
    }
  }

  /**
   * Toca o clássico som de confirmação da Urna Eletrônica
   * Sequência harmônica característica de confirmação de voto
   */
  function tocarSomConfirma() {
    if (!somHabilitado) return;
    const ctx = obterAudioContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;

      // Função auxiliar para tocar uma nota no sintetizador
      const dispararNota = (freq, inicio, duracao, volume = 0.12) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + inicio);

        const tempoNota = t + inicio;
        gain.gain.setValueAtTime(0, tempoNota);
        gain.gain.linearRampToValueAtTime(volume, tempoNota + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, tempoNota + duracao);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(tempoNota);
        osc.stop(tempoNota + duracao);
      };

      // Sequência clássica de dois tons do "pilili" da urna
      dispararNota(1318.51, 0.00, 0.09, 0.12); // Mi (E6)
      dispararNota(1760.00, 0.09, 0.22, 0.14); // Lá (A6)
    } catch (e) {
      console.warn('Erro ao reproduzir som de confirmação:', e);
    }
  }

  /**
   * Vibração tátil no celular (quando suportado pelo dispositivo)
   */
  function acionarVibracao(isConfirma = false) {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        if (isConfirma) {
          navigator.vibrate([25, 35, 60]);
        } else {
          navigator.vibrate(15);
        }
      } catch (e) {
        // Ignora silenciosamente se o navegador restringir vibração
      }
    }
  }

  // ----------------------------------------------------
  // PROCESSAMENTO DE PRESSIONAMENTO DE TECLA
  // ----------------------------------------------------
  const teclas = document.querySelectorAll('.tecla');
  let ultimoClique = null;

  function acionarTecla(teclaValor, elementoBotao = null) {
    if (!elementoBotao) {
      elementoBotao = document.querySelector(`.tecla[data-tecla="${teclaValor}"]`);
    }

    // Feedback sonoro e tátil correspondente
    if (teclaValor === 'CONFIRMA') {
      tocarSomConfirma();
      acionarVibracao(true);
    } else {
      tocarBeepTecla();
      acionarVibracao(false);
    }

    // Feedback visual animado
    if (elementoBotao) {
      elementoBotao.classList.add('tecla-ativa');
      setTimeout(() => {
        elementoBotao.classList.remove('tecla-ativa');
      }, 120);
    }

    ultimoClique = teclaValor;

    // Dispara evento customizado para permitir integração com outras aplicações
    const evento = new CustomEvent('urna:tecla', {
      bubbles: true,
      detail: {
        tecla: teclaValor,
        timestamp: Date.now()
      }
    });
    document.dispatchEvent(evento);
  }

  // ----------------------------------------------------
  // EVENTOS DE PONTEIRO / TOQUE / ACESSIBILIDADE
  // ----------------------------------------------------
  let ultimoDisparoTimestamp = 0;

  teclas.forEach((btn) => {
    const valor = btn.getAttribute('data-tecla');

    // Pointerdown dispara instantaneamente no mobile sem delay
    btn.addEventListener('pointerdown', (e) => {
      // Previne zoom ou arrasto indesejado mantendo resposta tátil imediata
      obterAudioContext();
      ultimoDisparoTimestamp = Date.now();
      acionarTecla(valor, btn);
    });

    // Suporte para ativação via leitor de tela / teclado físico caso pointerdown não tenha disparado
    btn.addEventListener('click', (e) => {
      const agora = Date.now();
      if (agora - ultimoDisparoTimestamp > 250) {
        obterAudioContext();
        acionarTecla(valor, btn);
      }
    });

    // Remove estado ativo caso o ponteiro saia do botão
    btn.addEventListener('pointerup', () => btn.classList.remove('tecla-ativa'));
    btn.addEventListener('pointerleave', () => btn.classList.remove('tecla-ativa'));
    btn.addEventListener('pointercancel', () => btn.classList.remove('tecla-ativa'));
  });

  // ----------------------------------------------------
  // INTEGRAÇÃO COM O TECLADO DO COMPUTADOR
  // ----------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // Se o foco estiver em outro input externo, não intercepta
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key;
    let teclaParaAcionar = null;

    if (key >= '0' && key <= '9') {
      teclaParaAcionar = key;
    } else if (key === 'Enter') {
      e.preventDefault();
      teclaParaAcionar = 'CONFIRMA';
    } else if (key === 'Backspace' || key === 'Delete' || key.toLowerCase() === 'c') {
      e.preventDefault();
      teclaParaAcionar = 'CORRIGE';
    } else if (key === ' ' || key.toLowerCase() === 'b') {
      e.preventDefault();
      teclaParaAcionar = 'BRANCO';
    }

    if (teclaParaAcionar) {
      obterAudioContext();
      acionarTecla(teclaParaAcionar);
    }
  });

  // ----------------------------------------------------
  // CONTROLE DO BOTÃO DE SOM (MUTAR/DESMUTAR)
  // ----------------------------------------------------
  const btnSom = document.getElementById('btnSom');
  const iconeAtivo = btnSom ? btnSom.querySelector('.icone-som-ativo') : null;
  const iconeMudo = btnSom ? btnSom.querySelector('.icone-som-mudo') : null;

  function atualizarIconeSom() {
    if (!iconeAtivo || !iconeMudo) return;
    if (somHabilitado) {
      iconeAtivo.style.display = 'block';
      iconeMudo.style.display = 'none';
      btnSom.setAttribute('aria-label', 'Desativar som do teclado');
    } else {
      iconeAtivo.style.display = 'none';
      iconeMudo.style.display = 'block';
      btnSom.setAttribute('aria-label', 'Ativar som do teclado');
    }
  }

  if (btnSom) {
    btnSom.addEventListener('click', (e) => {
      e.stopPropagation();
      somHabilitado = !somHabilitado;
      atualizarIconeSom();
    });
  }

  // ----------------------------------------------------
  // API GLOBAL PARA DESENVOLVEDORES (window.TecladoUrna)
  // ----------------------------------------------------
  window.TecladoUrna = {
    pressionar: (tecla) => acionarTecla(tecla),
    alternarSom: () => {
      somHabilitado = !somHabilitado;
      atualizarIconeSom();
      return somHabilitado;
    },
    isSomHabilitado: () => somHabilitado,
    getUltimaTecla: () => ultimoClique
  };

})();
