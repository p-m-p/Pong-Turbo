export class NullAudioAdapter {
  calls = [];

  play(name)      { this.calls.push(name); }
  played(name)    { return this.calls.includes(name); }
  callCount(name) { return this.calls.filter(n => n === name).length; }
  reset()         { this.calls = []; }
}
