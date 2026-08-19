# Oscillon

Oscillon is a browser-based Lissajous and harmonograph explorer. Two paired
oscillators drive a glowing phosphor trace on a simulated CRT screen, and the
same oscillators drive the audio you hear, so the ratio between them is both
a shape and a musical interval. It draws on the electronic oscillography of
Ben Laposky, who used oscilloscopes to compose "oscillons" in the 1950s, and
the algorithmic screen-based work of Herbert W. Franke — both treating the
oscilloscope as an instrument for drawing rather than just measuring.

Adjust frequency, amplitude, phase and waveform per axis, switch between a
pure Lissajous figure and a damped harmonograph pendulum trace, add FM or AM
cross-modulation between the axes, and drift or rotate the pattern over
time. Presets and a randomiser get you started, gallery mode cycles through
looks on its own, and PNG export saves a still of whatever is on screen.

**Live:** _to be added after deployment_

## Running it locally

Oscillon has no build step and no dependencies. Either open `index.html`
directly in a browser, or serve the folder with any static server, for
example:

```bash
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Controls

- **Power / Mute / Freeze** — start or stop the whole thing, silence audio
  without stopping the trace, or freeze the trace without stopping audio.
- **Randomise** — pick a new random configuration.
- **PNG** — download a still of exactly what is on screen, CRT overlay
  included.
- **Gallery mode** — auto-cycles presets, colours and motion on a timer.
- **Presets / Ratio** — jump to a named figure, or set the X:Y frequency
  ratio directly.
- **Mode** — Lissajous (steady loop) or Harmonograph (damped pendulum
  decay).
- **Oscillators** — frequency, amplitude, phase and waveform for each axis;
  a second oscillator per axis blends in when its amplitude is above zero.
- **Motion** — phase drift, rotation, damping (harmonograph only) and trace
  persistence (how long the phosphor trail lingers).
- **Modulation** — FM or AM cross-modulation of the X axis by the Y axis,
  applied to both the trace and the audio.
- **Phosphor** — trace colour, plus CRT scanline/vignette and bloom
  toggles.
- **Master** — output volume.

## Browser support

Oscillon needs the Web Audio API for sound; if it is unavailable the
visuals still run and the app says so, with the volume and mute controls
disabled. Audio only starts after a user gesture (the power button), per
every modern browser's autoplay policy — this is expected, not a bug.
`prefers-reduced-motion` is respected: phase drift, rotation and gallery
mode's auto-cycle all slow or stop accordingly.

## Licence

MIT. See [LICENSE](LICENSE).
