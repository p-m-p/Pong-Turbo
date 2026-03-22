export class RecordingRenderAdapter {
  frames = [];

  drawFrame(state) {
    this.frames.push(structuredClone(state));
  }

  lastFrame()          { return this.frames.at(-1); }
  frameCount()         { return this.frames.length; }
  ballPositions()      { return this.frames.map(f => ({ x: f.ball.x, y: f.ball.y })); }
  findFrameWhere(pred) { return this.frames.find(pred); }
}
