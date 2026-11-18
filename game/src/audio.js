// Sound: everything is synthesized with WebAudio — no audio files. A low
// bass-and-hat loop keeps the city moving, the engine hums with speed, the
// siren wails in two tones while the police are near, and gunshots, punches,
// pickups and mission jingles are short oscillator and noise bursts. The
// context is created on the first user gesture, and M mutes it all.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  let sirenNodes = null;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || !ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, cutoff) {
    if (!ensure() || !ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // A 32-step loop: a laid-back bass line in A minor with a hat on the off-beat.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0,
    55, 0, 55, 0, 65.4, 0, 55, 0, 82.4, 0, 73.4, 0, 65.4, 0, 58.3, 0];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const bass = BASS[musicStep % BASS.length];
      if (bass) tone(bass, 0.24, 'triangle', 0.16);
      if (musicStep % 2 === 1) noise(0.04, 0.05, 6000);
      if (musicStep % 16 === 0) tone(220, 0.5, 'sine', 0.05);
      musicStep += 1;
    }, 150);
  }

  function startSiren() {
    if (!ensure() || sirenNodes) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 720;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    sirenNodes = { osc, lfo, gain };
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try {
      sirenNodes.osc.stop();
      sirenNodes.lfo.stop();
    } catch {
      // Already stopped.
    }
    sirenNodes = null;
  }

  function startEngine() {
    if (!ensure() || engineNodes) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engineNodes = { osc, gain };
  }

  return {
    ensure,
    startMusic,
    click() {
      tone(880, 0.07, 'sine', 0.12);
    },
    shoot(distant) {
      noise(0.14, distant ? 0.1 : 0.32, 2800);
      tone(180, 0.08, 'square', distant ? 0.05 : 0.14, 0, 60);
    },
    punch() {
      tone(95, 0.12, 'sine', 0.3, 0, 45);
      noise(0.06, 0.12, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.16);
      tone(880, 0.12, 'sine', 0.16, 0.09);
    },
    crash() {
      noise(0.3, 0.3, 500);
      tone(70, 0.25, 'sine', 0.25, 0, 35);
    },
    sirenBlip() {
      tone(720, 0.16, 'square', 0.1);
      tone(960, 0.16, 'square', 0.1, 0.16);
    },
    mission() {
      tone(523, 0.12, 'triangle', 0.18);
      tone(659, 0.12, 'triangle', 0.18, 0.12);
      tone(784, 0.2, 'triangle', 0.2, 0.24);
    },
    busted() {
      tone(392, 0.25, 'triangle', 0.18);
      tone(311, 0.25, 'triangle', 0.18, 0.25);
      tone(233, 0.45, 'triangle', 0.18, 0.5);
    },
    siren(on) {
      if (on) startSiren();
      else stopSiren();
    },
    engine(speed, throttle) {
      startEngine();
      if (!engineNodes || !ctx) return;
      const target = throttle > 0 ? 0.035 + Math.min(speed / 36, 1) * 0.05 : 0.012;
      engineNodes.gain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      engineNodes.osc.frequency.setTargetAtTime(55 + Math.abs(speed) * 4.5, ctx.currentTime, 0.1);
    },
    engineOff() {
      if (!engineNodes) return;
      try {
        engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch {
        // Engine already gone.
      }
    },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
      if (m) stopSiren();
    },
    get muted() {
      return muted;
    },
  };
}
