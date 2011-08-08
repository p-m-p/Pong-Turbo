var Ball = function () {
	this.dx = arguments[0]; // delta x
	this.dy = arguments[1]; // delta y
	GameItem.apply(
			this
		,	Array.prototype.slice.call(arguments, 2)
	);
};

Ball.prototype = new GameItem();
Ball.prototype.constructor = Ball;

Ball.prototype.move = function (paddle) {
	if (this.y + this.h >= PONG.canvas.height) { // bottom wall
		this.dy = -this.dy;
		if (this.x - (this.w / 2) <= 0) { // stop corner clangers
			this.dx = -this.dx;
		}
	} else if (this.y <= 0) { // top wall
		this.dy = -this.dy;
		if (this.x - (this.w / 2) <= 0) { // stop corner clangers
			this.dx = -this.dx;
		}
	} else if (this.x <= 0) { // left wall or paddle
		this.dx = -this.dx;
	} else if (this.hasHitPaddle(paddle)) { // hit paddle
		PONG.playSound("paddle");
	} else if (GHOSTS.hasHitGhost(this)) { // hit a ghost
		PONG.playSound("ghost");
	} else if (this.x + this.w >= PONG.canvas.width) { // out of play
		PONG.newRoundOrGameOver();
	}
	this.x = this.x + this.dx;
	this.y = this.y + this.dy;
};

Ball.prototype.resetPosition = function () {
	this.x = 60;
	this.y = Math.floor((PONG.canvas.height - (this.h * 2)) * Math.random());
	this.dx = PONG.dt / 2;
	this.dy = PONG.dt / 2;
};

Ball.prototype.hasHitPaddle = function (paddle) {
	if ((this.x + this.w + this.dy) >= paddle.x && 
			this.y >= paddle.y && (this.y + this.w) <= (paddle.y + paddle.h)) {
		var bc = this.y + (this.h / 2)
			,	pt = paddle.y + (paddle.h / 4)
			,	x = Math.abs(Math.round(PONG.dt * Math.random()));
		if (x < PONG.dt / 2) { // stop wall clangers
			x = x + PONG.dt / 2;
		}
		if (this.dy < 0) {
			this.dy = -(PONG.dt - x);
		} else this.dy = PONG.dt - x;
		this.dx = -x;
		PONG.player.boostScore("paddle");
		return true;
	}
	return false;
};