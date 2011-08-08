var Player = function () {
	this.score = 0;
	this.balls = 5;
	this.level = 1;
};

Player.prototype.loseLife = function () {
	--this.balls;
};

Player.prototype.levelUp = function () {
	++this.level;
	this.boostScore("level");
};

Player.prototype.canContinue = function () {
	return this.balls > 1;
};

Player.prototype.reset = function () {
	this.balls = 5;
	this.score = 0;
};

Player.prototype.boostScore = function (reason) {
	switch (reason) {
		case "ghost":
			this.score += this.level * PONG.dt;
			break;
		case "level":
			this.score += this.level * 1000;
			break;
		case "paddle":
			this.score += PONG.dt;
			break;
	}
	PONG.updateScoreboard();
};