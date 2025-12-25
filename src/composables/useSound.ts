// Simple sound manager
// Connect specific events to specific audio files
// Note: Ideally these should be local assets in /public/sounds/

const sounds = {
    click: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3'), // Short Click
    join: new Audio('https://cdn.freesound.org/previews/274/274183_5123851-lq.mp3'),  // Pop/Bubble
    tick: new Audio('https://cdn.freesound.org/previews/269/269026_5094865-lq.mp3'),  // Clock Tick
    timeout: new Audio('https://cdn.freesound.org/previews/337/337049_3232293-lq.mp3'), // Alarm/Whistle
    success: new Audio('https://cdn.freesound.org/previews/270/270402_5123851-lq.mp3'), // Success Chime
    scribble: new Audio('https://cdn.freesound.org/previews/175/175409_1326499-lq.mp3') // Writing sound?
};

// Preload
Object.values(sounds).forEach(audio => {
    audio.volume = 0.5;
    audio.load();
});

export function useSound() {

    const playSound = (name: keyof typeof sounds) => {
        try {
            const audio = sounds[name];
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.warn('Audio play blocked', e));
            }
        } catch (e) {
            console.warn('Audio error', e);
        }
    };

    return {
        playClick: () => playSound('click'),
        playJoin: () => playSound('join'),
        playTick: () => playSound('tick'),
        playAlarm: () => playSound('timeout'),
        playSuccess: () => playSound('success'),
        playWriting: () => playSound('scribble')
    };
}
