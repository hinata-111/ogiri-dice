"""Render original audition sketches; does not alter the in-game audio engine.

Python + NumPy only. No downloaded recordings, soundfonts or reference melodies.
Run from any directory. Output is 44.1 kHz stereo PCM WAV plus measurable metadata.
"""
from pathlib import Path
import json
import math
import wave
import numpy as np

RATE = 44100
DEST = Path(__file__).resolve().parents[1] / 'dev/audio/previews/2026-09-26'
DEST.mkdir(parents=True, exist_ok=True)


def tone(voice, pitch, gate, rng):
    hz = 440 * 2 ** ((pitch - 69) / 12)
    tail = .55 if voice in ('felt', 'keys') else .32
    t = np.arange(round((gate + tail) * RATE), dtype=np.float64) / RATE
    attack = 1 - np.exp(-t / (.016 if voice == 'nylon' else .023))
    release = np.exp(-np.maximum(0, t - gate) / (tail / 4))
    sig = np.zeros_like(t)
    if voice == 'felt':
        for partial, amp in enumerate([1, .21, .065, .025, .008], 1):
            freq = hz * partial * math.sqrt(1 + .000035 * partial ** 2)
            decay = np.exp(-t * (.65 + partial * .21 + hz / 1700))
            # Very small beating between piano strings, without chorus modulation.
            sig += amp * decay * (np.sin(2*np.pi*freq*t) + .32*np.sin(2*np.pi*freq*1.0008*t)) / 1.32
    elif voice == 'nylon':
        for partial in range(1, 9):
            amp = math.sin(partial * .23 * np.pi) / partial ** 1.6
            sig += amp * np.sin(2*np.pi*hz*partial*t + .06*partial) * np.exp(-t*(.9 + partial*.45))
        sig += .025 * np.sin(2*np.pi*185*t) * np.exp(-t*22)
    elif voice == 'wood':
        sig = np.sin(2*np.pi*hz*t)*np.exp(-3.3*t)
        sig += .10*np.sin(2*np.pi*hz*3.98*t)*np.exp(-13*t)
        sig += .016*np.sin(2*np.pi*hz*9.2*t)*np.exp(-27*t)
    elif voice == 'keys':
        sig = np.sin(2*np.pi*hz*t)*np.exp(-1.05*t)
        sig += .12*np.sin(2*np.pi*hz*2*t)*np.exp(-2.9*t)
        sig += .027*np.sin(2*np.pi*hz*3*t)*np.exp(-5.2*t)
    elif voice == 'bass':
        sig = (np.sin(2*np.pi*hz*t) + .08*np.sin(2*np.pi*hz*2*t))*np.exp(-1.2*t)
        attack = 1 - np.exp(-t/.035)
    elif voice == 'brush':
        noise = rng.normal(0, 1, len(t))
        sig = np.convolve(noise, np.ones(19)/19, mode='same') * np.exp(-t*45)
        attack = 1 - np.exp(-t/.009)
    return sig * attack * release


class Sketch:
    def __init__(self, name, title, bpm, description, seed, cutoff):
        self.name, self.title, self.bpm = name, title, bpm
        self.description, self.cutoff = description, cutoff
        self.beat = 60 / bpm
        self.duration = 32*self.beat + 2.0
        self.mix = np.zeros((math.ceil(self.duration*RATE), 2), dtype=np.float64)
        self.rng = np.random.default_rng(seed)
        self.notes = 0

    def note(self, voice, beat, pitch, length, level, pan=0):
        # The breathing room is composed; only tiny performance offsets are random.
        offset = self.rng.uniform(-.009, .009)
        start = max(0, round((.06 + beat*self.beat + offset)*RATE))
        signal = tone(voice, pitch, length*self.beat, self.rng)
        level *= self.rng.uniform(.94, 1.025)
        count = min(len(signal), len(self.mix)-start)
        if count <= 0:
            return
        angle = (pan+1)*np.pi/4
        self.mix[start:start+count, 0] += signal[:count]*level*np.cos(angle)
        self.mix[start:start+count, 1] += signal[:count]*level*np.sin(angle)
        self.notes += 1

    def melody(self, voice, phrases, level, pan=.12):
        for bar, phrase in enumerate(phrases):
            for beat, pitch, length in phrase:
                shape = .92 if bar in (3, 7) else 1
                self.note(voice, 4*bar+beat, pitch, length, level*shape, pan)

    def finish(self):
        # Restrained early reflections, not a long ambient wash or synthetic chorus.
        dry = self.mix.copy()
        for delay, gain in [(.047, .065), (.079, .052), (.127, .035), (.191, .022)]:
            shift = round(delay*RATE)
            self.mix[shift:] += dry[:-shift, ::-1]*gain
        freqs = np.fft.rfftfreq(len(self.mix), 1/RATE)
        spectral = np.fft.rfft(self.mix, axis=0)
        gentle_cut = 1/np.sqrt(1 + (freqs/self.cutoff)**6)
        # Remove DC/subsonics without adding bass emphasis.
        low_cut = freqs**2/(freqs**2 + 34**2)
        self.mix = np.fft.irfft(spectral*(gentle_cut*low_cut)[:, None], n=len(self.mix), axis=0)
        active = self.mix[int(.2*RATE):int(32*self.beat*RATE)]
        rms = float(np.sqrt(np.mean(active**2)))
        self.mix *= 10**(-24/20)/max(rms, 1e-9)
        peak = float(np.max(np.abs(self.mix)))
        if peak > .46:
            self.mix *= .46/peak
        fade_in, fade_out = int(.035*RATE), int(.65*RATE)
        self.mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
        self.mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
        assert np.isfinite(self.mix).all() and np.max(np.abs(self.mix)) < .5
        pcm = np.round(self.mix*32767).astype('<i2')
        path = DEST / f'{self.name}.wav'
        with wave.open(str(path), 'wb') as out:
            out.setnchannels(2); out.setsampwidth(2); out.setframerate(RATE)
            out.writeframes(pcm.tobytes())
        spec = np.abs(np.fft.rfft(self.mix, axis=0))**2
        bright_share = float(spec[freqs > 4000].sum()/max(spec.sum(), 1e-12))
        active_rms = float(np.sqrt(np.mean(self.mix[int(.2*RATE):int(32*self.beat*RATE)]**2)))
        return dict(file=path.name, title=self.title, bpm=self.bpm,
                    duration_seconds=round(len(pcm)/RATE, 2), notes=self.notes,
                    peak_dbfs=round(20*np.log10(np.max(np.abs(self.mix))), 2),
                    active_rms_dbfs=round(20*np.log10(active_rms), 2),
                    energy_above_4khz_percent=round(bright_share*100, 3),
                    description=self.description)


def lobby():
    song = Sketch('a-lobby-piano', '開演前のロビー', 72, 'フェルトピアノ系。打楽器なし。長めの音と休符を中心にした最も穏やかな案。', 12, 3000)
    chords = [(41,[53,57,60,64]),(38,[53,57,60,64]),(46,[53,57,62,65]),(43,[52,58,62,67]),
              (45,[55,60,64,67]),(38,[53,57,60,64]),(43,[53,58,62,65]),(41,[53,57,60,67])]
    for bar, (root, chord) in enumerate(chords):
        song.note('bass', 4*bar, root, 2.6, .15, -.05)
        for i, pitch in enumerate(chord):
            song.note('felt', 4*bar+.08+i*.018, pitch, 3.25, .085, -.19+i*.035)
    phrases = [
        [(.4,69,1.2),(2.15,72,1.4)], [(.5,74,.8),(1.85,72,1.5)],
        [(.4,70,1.4),(2.65,69,.65)], [(.3,67,1.65),(2.8,64,.7)],
        [(.4,69,.85),(1.7,72,.9),(3,76,.6)], [(.3,74,1.55),(2.6,72,.85)],
        [(.3,70,1.05),(1.9,69,.7),(3.05,67,.5)], [(.3,69,1.1),(2,65,1.7)],
    ]
    song.melody('felt', phrases, .31)
    return song.finish()


def stroll():
    song = Sketch('b-tokyo-guitar', '昼下がりの東京', 80, 'ナイロンギター系。指弾きの柔らかい刻みで、静かさと街歩きの軽さを両立。', 23, 3700)
    chords = [(36,[55,60,64,69]),(45,[55,60,64,67]),(41,[53,57,60,64]),(43,[55,59,62,69]),
              (40,[55,59,62,67]),(45,[55,60,64,67]),(43,[53,59,62,64]),(36,[55,60,64,69])]
    pattern = [(0,0,.10),(.85,1,.11),(1.65,2,.09),(2.55,3,.10),(3.35,1,.075)]
    for bar,(root,chord) in enumerate(chords):
        song.note('nylon',4*bar,root,2.2,.26,-.12)
        for beat,index,velocity in pattern:
            song.note('nylon',4*bar+beat+.04,chord[index],1.3,velocity,-.22)
        if bar in (1,3,5): song.note('nylon',4*bar+2.1,root+7,1.2,.17,-.1)
    phrases = [
        [(.2,64,.85),(1.6,67,.55),(2.5,69,1)],[(.25,67,1.3),(2.3,64,.9)],
        [(.2,65,1),(1.9,69,.65),(3,67,.6)],[(.3,62,1.4),(2.7,64,.7)],
        [(.3,67,.7),(1.5,71,.6),(2.7,72,.9)],[(.35,71,1.1),(2.5,69,.9)],
        [(.2,67,.7),(1.55,65,.65),(2.8,62,.7)],[(.3,64,.95),(1.9,60,1.8)],
    ]
    song.melody('nylon',phrases,.39,.19)
    return song.finish()


def green_room():
    song = Sketch('c-green-room-mallet', '出番待ちの楽屋', 88, '丸い木琴とエレピ系。音を短く、休符を多くして控えめなゲームらしい弾みを残す。', 31, 3200)
    chords=[(36,[52,55,59,62]),(45,[52,55,60,64]),(38,[53,57,60,64]),(43,[53,57,59,64]),
            (40,[55,59,62,67]),(45,[55,60,64,67]),(43,[53,57,59,64]),(36,[52,55,60,62])]
    for bar,(root,chord) in enumerate(chords):
        song.note('bass',4*bar,root,1.5,.17,-.08)
        song.note('bass',4*bar+2,root+7,1.2,.11,-.08)
        for beat in (.15,2.4):
            for i,pitch in enumerate(chord):
                song.note('keys',4*bar+beat+i*.013,pitch,1.2,.064,-.18)
        # Two tiny soft brushes per four-bar phrase; no kick or hi-hat loop.
        if bar in (1,5): song.note('brush',4*bar+3,0,.13,.026,.2)
    phrases=[
        [(.35,67,.7),(1.35,72,.6),(2.6,71,.65)],[(.35,69,.75),(1.75,67,.6)],
        [(.35,65,.7),(1.4,69,.65),(2.65,72,.65)],[(.4,71,1),(2.15,67,.8)],
        [(.35,71,.6),(1.4,74,.65),(2.65,76,.8)],[(.35,74,.65),(1.5,72,.7)],
        [(.35,71,.65),(1.65,69,.5),(2.6,67,.6)],[(.35,64,.8),(1.8,60,1.6)],
    ]
    song.melody('wood',phrases,.29,.13)
    return song.finish()


if __name__ == '__main__':
    results = [lobby(), stroll(), green_room()]
    (DEST/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))
