var GHOSTS = (function () {

	var ghosts = []
		,	ghostImage = new Image()
		,	ghostSize = 32;

	ghostImage.src = "images/ghost.png";

	var Ghost = function () {
		this.direction = 'd';
		this.image = arguments[0];
		GameItem.apply(
				this
			,	Array.prototype.slice.call(arguments, 1)
		);
	};

	Ghost.prototype = new GameItem();
	Ghost.prototype.constructor = Ghost;

	Ghost.prototype.draw = function (context) {
		context.drawImage(
				this.image
			,	this.x
			,	this.y
		);
	};

	Ghost.prototype.move = function () {
		var speed = PONG.dt / 4;
		if (this.direction === 'd') {
			if ((this.y + this.h + speed) <= PONG.canvas.height - this.h) {
				this.y = this.y + speed;
			} else {
				this.direction = 'u';
			}
		} else {
			if (this.y - speed >= 0) {
				this.y = this.y - speed;
			} else {
				this.direction = 'd';
			}
		}
	};

	Ghost.prototype.takeHit = function () {
		PONG.player.boostScore("ghost");
		PONG.playSound("ghost");
		// need to add particle spray for ghost kill here
	};

	return {
		
			spawnGhosts: function (num) {
				ghosts = [];
				num = num || 5;
				for (var i = 0; i < num; ++i) {
					ghosts[i] = new Ghost(
							ghostImage
						,	30
						,	(i*80)
						,	ghostSize
						,	ghostSize
					);
				}
			}

		,	hasHitGhost: function (ball) {
				for (var i = 0; i < ghosts.length; ++i) {
					if (
							(ball.x + ball.w >= ghosts[i].x && 
								ball.x + ball.w < ghosts[i].x + ghosts[i].w) &&
							(ball.y >= ghosts[i].y &&
							 	ball.y + ball.h <= ghosts[i].y + ghosts[i].h)
							) {
						ghosts[i].takeHit();
						// this will need to be changed (see takeHit of Ghost)
						ghosts.splice(i, 1);
						return true;
					}
				}
				return false;
			}

		,	moveGhosts: function () {
				for (var i = 0; i < ghosts.length; ++i) {
					ghosts[i].move();
				}
			}

		,	drawGhosts: function (context) {
				for (var i = 0; i < ghosts.length; ++i) {
					ghosts[i].draw(context);
				}
			}

		,	allDead: function () {
				return (ghosts.length == 0);
			}

	};
	
})();