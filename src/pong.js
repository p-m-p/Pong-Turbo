var PONG = (function (ghosts) {

	var ball
		,	player
		,	gameLoop
		,	gameSounds = {
					paddle: null
				,	ghost: null
				,	roundEnd: null
				,	levelUp: null
			}
		,	soundFolder = "mp3"
		,	scoreboard = {
					lives: null
				,	player: null
				,	score: null
			};

	this.load = function () {
		var soundtrack = document.getElementById("soundtrack");
		if (soundtrack.readystate < 3) {
			setTimeout(this.load, 100);
		} else {
			var start = document.getElementById("startGame");
			document.getElementById("loadingMessage").style['display'] = "none";
			start.style['display'] = "block";
			start.disabled = false;
			start.addEventListener("click", function () {
				document.getElementById("loading").style['display'] = "none";
				document.getElementById("game").style['display'] = "block";
				soundtrack.play();
				startNewGame();
				this.blur();
			}, false);
			start.focus();
		}
	};

	this.init = function () {
		// game audio and soundtrack controls
		var audioBlock = document.getElementById("gameSounds");
		if (~navigator.userAgent.toLowerCase().search("firefox")) {
			soundFolder = "ogg";
		}
		for (var sound in gameSounds) {
			gameSounds[sound] = document.createElement("audio");
			gameSounds[sound].src = 
				"sound/" + soundFolder + "/" + sound + "." + soundFolder;
			audioBlock.appendChild(gameSounds[sound]);
		}
		document
			.getElementById("toggleSound")
			.addEventListener("click", toggleSoundtrack, false);

		this.canvas = document.getElementById("pongBoard");
		this.context = this.canvas.getContext("2d");
		this.player = new Player();

		scoreboard.balls = document.querySelectorAll(".ball");
		scoreboard.score = document.getElementById("playerscore");
		scoreboard.level = document.getElementById("playerlevel");

		window.addEventListener("keydown", function (ev) {
			if (ev.keyCode === 38 || ev.keyCode === 104) { // going up
				paddle.moveY = 'u';
			} else if (ev.keyCode === 40 || ev.keyCode === 98) { // going down
				paddle.moveY = 'd';
			} else if (!gameLoop && ev.target.id !== "startGame" && 
					ev.keyCode === 13) { // new game
				startNewGame.call(PONG);
			}
		}, false);
		window.addEventListener("keyup", function (ev) {
			paddle.moveY = false;
		}, false);

		this.load();
	};

	var startNewGame = function () {
		for (var i = 0; i < scoreboard.balls.length; ++i) {
			scoreboard.balls[i].className = "ball";
		}
		this.canvas.width = this.canvas.width;
		this.dt = 16;
		paddle = new Paddle(
				this.canvas.width - 15
			,	(this.canvas.height / 2) - 20
			,	10
			,	60
		);
		ball = new Ball(this.dt/2, this.dt/2, 60, 20, 10, 10);
		this.player.reset();
		this.updateScoreboard();
		gameLoop = setInterval(update, 1000/30);
		ghosts.spawnGhosts();
	};

	this.newRoundOrGameOver = function () {
		if (this.player.canContinue()) {
			ball.resetPosition();
			this.playSound("roundEnd");
		} else {
			gameLoop = clearInterval(gameLoop);
			this.canvas.width = this.canvas.width;
			this.context.fillStyle = "orange";
			this.context.font = "bold 14px Arial";
			this.context.fillText(
					"Game over! Hit enter to play again"
				,	(this.canvas.width / 2) - 110
				,	(this.canvas.height / 2) - 7
			);
		}
		this.loseBall();
	};

	var update = function () {
		ball.move(paddle);
		paddle.move();
		if (ghosts.allDead()) {
			this.dt += 2;
			this.player.levelUp();
			this.playSound("levelUp");
			ghosts.spawnGhosts();
		} else ghosts.moveGhosts();
		draw();
	};

	var draw = function () {
		if (gameLoop) {
			this.canvas.width = this.canvas.width;
			this.context.fillStyle = "orange";
			ball.draw(this.context);
			paddle.draw(this.context);
			ghosts.drawGhosts(this.context);
		}
	};

	var toggleSoundtrack = function () {
		var soundtrack = document.getElementById("soundtrack");
		if (soundtrack.muted) {
			soundtrack.muted = false;
			this.className = "";
		} else {
			soundtrack.muted = true;
			this.className = "muted";
		}
		// don't want to start playing again on new game!
		this.blur();
	}

	this.updateScoreboard = function () {
		scoreboard.score.textContent = this.player.score;
	};

	this.playSound = function (sound) {
		gameSounds[sound].play();
	};

	this.loseBall = function () {
		scoreboard.balls[this.player.balls - 1].className = "ball dead";
		this.player.loseLife();
	};

	return this;

})(GHOSTS);

window.onload = function () {
	PONG.init();
}
