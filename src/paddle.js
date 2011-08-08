var Paddle = function () {
	this.moveY = false;
	GameItem.apply(this, arguments);
};

Paddle.prototype = new GameItem();
Paddle.prototype.constructor = Paddle;

Paddle.prototype.move = function () {
	var moveAmount = (1.2 * PONG.dt);// slightly faster than ball
	if (this.moveY) {
		if (this.moveY === 'u') { // going up
			if (this.y - moveAmount >= 0) {
				this.y = this.y - moveAmount;
			} else {
				this.y = 0;
			}
		} else if (this.moveY === 'd') { // going down
			if ((this.y + this.h) + moveAmount <= PONG.canvas.height) {
				this.y = this.y + moveAmount;
			} else {
				this.y = PONG.canvas.height - this.h;
			}
		}
	}
};