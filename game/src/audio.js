// audio.js — every sound in Surya Bay is synthesized with WebAudio:
// no audio files, no network. Engine hum, siren, gunshots, punches,
// pickups, cash and a small bass-driven music loop.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicOn = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = "sawtooth";
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave that alternates two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = "square";
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff || 1800;
    const g = ctx.createGain();
    g.gain.value = vol || 0.4;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  function setEngine(driving, speed01) {
    if (!ctx) return;
    const target = driving ? 0.05 + speed01 * 0.1 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, ctx.currentTime, 0.1);
  }

  function setSiren(on) {
    if (!ctx) return;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.15);
  }

  function tick(dt) {
    if (!ctx || !sirenOsc) return;
    sirenTimer += dt;
    if (sirenTimer > 0.42) {
      sirenTimer = 0;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
    }
  }

  function gunshot() {
    noiseBurst(0.16, 0.5, 2600);
    blip(160, 0.1, "square", 0.25, 60);
  }
  function punch() {
    noiseBurst(0.09, 0.35, 700);
  }
  function pickup() {
    blip(660, 0.09, "sine", 0.22);
    setTimeout(() => blip(990, 0.12, "sine", 0.22), 70);
  }
  function cash() {
    blip(880, 0.08, "triangle", 0.25);
    setTimeout(() => blip(1174, 0.08, "triangle", 0.25), 80);
    setTimeout(() => blip(1568, 0.16, "triangle", 0.25), 160);
  }
  function sting() {
    const notes = [392, 523, 659, 784];
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, "triangle", 0.22), i * 110));
  }
  function denied() {
    blip(220, 0.15, "square", 0.18, 160);
  }
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    musicTimer = setInterval(() => {
      if (!ctx) return;
      const n = bass[musicStep % bass.length];
      musicStep++;
      if (n) blip(n, 0.32, "triangle", 0.12);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
    }, 240);
  }
  function stopMusic() {
    musicOn = false;
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }
  return {
    ensure, setEngine, setSiren, tick, gunshot, punch, pickup, cash,
    sting, denied, startMusic, stopMusic,
  };
}
