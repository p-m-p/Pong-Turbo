var GameItem = function (x, y, w, h) {
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
};

GameItem.prototype.draw = function (context) {
	context.fillRect(this.x, this.y, this.w, this.h);
};