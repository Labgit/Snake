$(function () {

    let options = {
        canvas: $('#snake-canvas').get(0),
        buttonNewGame: $('#snake-newgame').get(0),
        pathGround: '/Content/images/map.bmp',
        unit: 10,
        scoreTop: 42,
        scoreLeft: 20,
        borderTop: 60,
        borderBottom: 10,
        borderLeft: 10,
        borderRight: 10,
        width: 1200,
        height: 850,
        animateIntervalBase: 80, 
        animateIntervalLimit: 1, 
        animateIntervalIncrement: 0.7
    };

    myGame = new game(options);
    myGame.run();
    myGame.stop();
    myGame.run();

    console.log('done!');
});

const directions = {
    left: 'left',
    right: 'right',
    up: 'up',
    down: 'down'
}

class coordinate {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class stats {
    constructor() {
        this.updates = 0;
        this.score = 0;
        this.timeStart = Date.now();
        this.timeEnd;
    }

    timeInSeconds() {
        return (this.timeEnd - this.timeStart) / 1000;
    }

    printStats() {
        console.log('Start: ' + this.timeStart);
        console.log('End: ' + this.timeEnd);
        console.log('Seconds: ' + this.timeInSeconds());
        console.log('Updates: ' + this.updates);
        console.log('Score: ' + this.score);
    }
}

class game {
    constructor(params) {
        this.canvas = params.canvas;
        this.context = this.canvas.getContext('2d');

        this.buttonNewGame = params.buttonNewGame;

        this.ground = new Image();
        this.ground.src = params.pathGround;

        this.unit = params.unit; // square size in pixels
        this.border = params.border; // size of border, should be one unit
        this.width = params.width; // size of x axis in pixels
        this.height = params.height; // size of y axis in pixels

        // for score text
        this.scoreTop = params.scoreTop;
        this.scoreLeft = params.scoreLeft;

        // to define boundaries
        this.borderTop = params.borderTop;
        this.borderBottom = params.borderBottom;
        this.borderLeft = params.borderLeft;
        this.borderRight = params.borderRight;

        // define axis, this should be the only time other than draw that x,y mixes with width, height, unit
        this.xMax = (this.width - (params.borderLeft + params.borderRight + this.unit)) / this.unit; 
        this.yMax = (this.height - (params.borderTop + params.borderBottom + this.unit)) / this.unit;
        this.xMin = 0;
        this.yMin = 0;

        // make sure the canvas has the correct dimensions 
        if (this.canvas.width != this.width) { this.canvas.width = this.width };
        if (this.canvas.height != this.height) { this.canvas.height = this.height };

        // too be defined in newGame
        this.firstPlay = false;
        this.direction;
        this.map;
        this.snake;
        this.stats;

        // animation variables
        this.stopId;
        this.animate = false;
        this.animateLast = 0;
        this.animateIntervalBase = params.animateIntervalBase == undefined ? 80 : params.animateIntervalBase; // time between animations in ms
        this.animateIntervalLimit = params.animateIntervalLimit == undefined ? 1 : params.animateIntervalLimit; // time between animations in ms

        // percent mulitplied against current interval to increase difficulty, decrease time between animation
        this.animateIntervalIncrement = params.animateIntervalIncrement == undefined ? 0.7 : params.animateIntervalIncrement;
        this.animateInterval = this.animateIntervalBase; // this will change based on difficulty
        this.difficultyInterval = params.difficultyInterval == undefined ? 2 : params.difficultyInterval; // number of points before increasing difficulty

        // snake and food variables
        this.snakeLength = params.snakeLength == undefined ? 3 : params.snakeLength; // snake length
        this.colorSnake = params.colorSnake == undefined ? 'green' : params.colorSnake; // snake color
        this.colorFood = params.colorFood == undefined ? 'red' : params.colorFood; // food color

        // wall variables
        this.wallsActive = true;
        this.wallsLengthMin = 10;
        this.wallsLengthMax = 50;
        this.wallsStarting = 5;
        this.wallsSeparation = 5;
        this.wallsFromSnake = 10;
        this.wallsColor = 'black';

        // on death function the user can set
        this.callAfterDeath;

        // attach events
        let _this = this;

        $(this.buttonNewGame).on('click', function () {
            _this.newGame();
        });

        $(document).on('keydown', function (e) {
            _this.updateDirection(e);
        });
    }

    run() {
        this.animate = true;
        window.requestAnimationFrame(this.step.bind(this));
    }

    stop() {
        this.animate = false;
        cancelAnimationFrame(this.stopId);
    }

    step(timestamp) {
        if ((timestamp - this.animateLast) >= this.animateInterval) {
            this.animateLast = timestamp;
            this.draw();
        }
        this.stopId = window.requestAnimationFrame(this.step.bind(this));
    }

    newGame() {
        // if we haven't recorded the first game
        if(!this.firstPlay) this.firstPlay = true;

        // start new game
        this.direction = directions.left; // initial direction
        this.animateInterval = this.animateIntervalBase // base difficulty

        // initial values for snake
        let snakeOptions = {
            xStart: Math.ceil(this.xMax / 2),
            yStart: Math.ceil(this.yMax / 2),
            length: this.snakeLength,
            color: this.colorSnake
        };
        this.snake = new snake(snakeOptions); // intialize snake

        // initial values for map
        let mapOptions = {
            xMax: this.xMax,
            yMax: this.yMax,
            xMin: this.xMin,
            yMin: this.yMin,
            snake: this.snake,
            wallsActive: this.wallsActive,
            wallsLengthMin: this.wallsLengthMin,
            wallsLengthMax: this.wallsLengthMax,
            wallsStarting: this.wallsStarting,
            wallsSeparation: this.wallsSeparation,
            wallsFromSnake: this.wallsFromSnake,
            wallsColor: this.wallsColor
        };
        this.map = new map(mapOptions); // initialize map
        this.map.generateFood(); // create food for initial draw

        this.stats = new stats(); // for recording stats
    }

    updateGame() {
        if (!this.snake.isDead) {
            this.stats.updates++;

            this.snake.move(this.direction);

            if (this.map.hitBoundary(this.snake.nextMove)) {
                this.snake.kill();
                this.stats.timeEnd = Date.now();
                this.stats.printStats();
                if(this.callAfterDeath != undefined) this.callAfterDeath(this.stats);
                return;
            }

            if (this.map.hitFood()) {
                this.snake.grow();
                this.stats.score++;
                this.updateDifficulty();
                this.map.generateFood();
            }
            this.snake.confirmMove();
        }
    }

    updateDifficulty() {
        if ((this.stats.score % this.difficultyInterval) == 0 && this.animateInterval > this.animateIntervalLimit) {
            let newInterval = this.animateIntervalIncrement * this.animateInterval;
            if (newInterval > this.animateIntervalLimit) {
                this.animateInterval = newInterval;
            } else {
                this.animateInterval = this.animateIntervalLimit;
            }
        }
    }

    updateDirection(e) {
        if (e.keyCode == 37) {
            this.direction = directions.left;
        } else if (e.keyCode == 38) {
            this.direction = directions.up;
        } else if (e.keyCode == 39) {
            this.direction = directions.right;
        } else if (e.keyCode == 40) {
            this.direction = directions.down;
        }
    }

    draw() {
        this.drawGround();
        if (this.firstPlay) {
            this.drawScore();
            this.updateGame();
            this.drawWalls();
            this.drawFood();
            this.drawSnake();
        }
    }

    drawGround() {
        this.context.drawImage(this.ground, 0, 0);
    }

    drawScore() {
        let message = "Score: " + this.stats.score;
        this.context.fillStyle = "white";
        this.context.font = "34px Arial";
        this.context.fillText(message, this.scoreLeft, this.scoreTop);
    }

    drawFood() {
        this.drawUnit(this.map.foodXY, this.colorFood);
    }

    drawSnake() {
        for (let i = 0; i < this.snake.length; i++) {
            this.drawUnit(this.snake.coordinates[i], this.snake.color);
        }
    }

    drawWalls() {
        if (!this.wallsActive) return;
        for (let i = 0; i < this.map.walls.length; i++) {
            let wall = this.map.walls[i];
            for (let j = 0; j < wall.length; j++) {
                this.drawUnit(wall[j], this.wallsColor);
            }
        }
    }

    drawUnit(coordinate, color) {
        // translate x and y
        let px = this.borderLeft + (coordinate.x * this.unit);
        let py = this.borderTop + (coordinate.y * this.unit);

        this.context.fillStyle = color;
        this.context.fillRect(px, py, this.unit, this.unit);
    }

    // can be set by user, and run their function, passed game stats
    onDeath(f) {
        this.callAfterDeath = f;
    }
}

class snake {
    constructor(params) {
        this.length = params.length;
        this.color = params.color;

        this.lastDirection = directions.left;
        this.isDead = false;

        this.coordinates = [];
        this.nextMove; // to be added to coordinates in confirmMove

        // construct starting coordinates, tail going in positive x direction
        // snake heading heading in negative x direction
        for (let i = 0; i < this.length; i++) {
            let xy = new coordinate(params.xStart + i, params.yStart);
            this.coordinates.push(xy);
        }
    }

    kill() {
        this.isDead = true;
    }

    grow() {
        this.length++;
    }

    confirmMove() {
        this.coordinates.unshift(this.nextMove); // confirm new coordinate, append to top of list

        // if we haven't grown
        if (this.length < this.coordinates.length) {
            this.coordinates.pop(); // remove last coordinate
        }
    }

    move(direction) {
        if (this.isDead) { return; } // don't move if dead

        let last = this.coordinates[0]; // get last move's coordinates

        // if direciton is oppsite, remain unchanged
        if (this.isDirectionOpposite(direction)) {
            direction = this.lastDirection;
        }

        // create new coordinates for direction
        switch (direction) {
            case directions.right:
                this.nextMove = new coordinate(last.x + 1, last.y);
                break;

            case directions.left:
                this.nextMove = new coordinate(last.x - 1, last.y);
                break;

            case directions.down:
                this.nextMove = new coordinate(last.x, last.y + 1);
                break;

            case directions.up:
                this.nextMove = new coordinate(last.x, last.y - 1);
                break;
        }

        // update lastDirection
        this.lastDirection = direction;
    }

    isDirectionOpposite(direction) {
        switch (direction) {
            case directions.right:
                return this.lastDirection == directions.left;
            case directions.left:
                return this.lastDirection == directions.right;
            case directions.down:
                return this.lastDirection == directions.up;
            case directions.up:
                return this.lastDirection == directions.down;
        }
    }

    // for food or other object placement - takes coordinates
    isIntersection(c) {
        for (let i = 0; i < this.coordinates.length; i++) {
            if (this.coordinates[i].x == c.x && this.coordinates[i].y == c.y) {
                return true;
            }
        }
        return false;
    }

    fromFuture(c) {
        let lastMove = this.coordinates[0];

        switch (this.lastDirection) {
            case directions.up:
                if (lastMove.x == c.x && lastMove.y > c.y) return lastMove.y - c.y;
            case directions.right:
                if (lastMove.y == c.y && lastMove.x < c.x) return c.x - lastMove.x;
            case directions.down:
                if (lastMove.x == c.x && lastMove.y < c.y) return c.y - lastMove.y;
            case directions.left:
                if (lastMove.y == c.y && lastMove.x > c.x) return lastMove.x - c.x;
        }

        return 100000;
    }

    dxdy(direction) {
        switch (direction) {
            case directions.up:
                return new coordinate(0, -1); // up
            case directions.right:
                return new coordinate(1, 0); // right
            case directions.down:
                return new coordinate(0, 1); // down
            case directions.left:
                return new coordinate(-1, 0); // left
        }
    }
}

// not used yet
class map {

    constructor(params) {
        // border values
        this.xMax = params.xMax;
        this.yMax = params.yMax;
        this.xMin = params.xMin;
        this.yMin = params.yMin;

        // food coordinates
        this.foodXY;

        // wall variables
        this.wallsActive = params.wallsActive;
        this.wallsLengthMin = params.wallsLengthMin;
        this.wallsLengthMax = params.wallsLengthMax;
        this.wallsStarting = params.wallsStarting;
        this.wallsSeparation = params.wallsSeparation;
        this.wallsFromSnake = params.wallsFromSnake;

        // we will detect if the snake has a collision, other than with it self
        this.snake = params.snake;

        // collection of arrays for each wall coordinates
        this.walls = [];

        if (this.wallsActive) {
            for (let i = 0; i < this.wallsStarting; i++) {
                this.generateWall();
            }
        }
    }

    generateWall() {
        let hasTurned = false;
        let turnChance = 0.97;
        let delta = this.randomDirection();
        let length = (this.wallsLengthMax - this.wallsLengthMin) + Math.floor(Math.random() * this.wallsLengthMin);

        let i = 0;
        let wall;
        let isValid = true;
        do {
            i = 0;
            isValid = true; // unless we hit a wall, it's valid, and we break out of the loop
            wall = []; // fresh wall, incase we failed
            wall.push(this.generateBrick()); // first brick
            hasTurned = false;

            // minus one because we already generated
            for (let i = 0; i < length - 1; i++) {
                let roll = Math.random();
                if (!hasTurned && roll >= turnChance) {
                    delta = this.randomDirection();
                    hasTurned = true;
                }

                let nextBrick = new coordinate(wall[i].x + delta.x, wall[i].y + delta.y);
                if (this.hitBoundary(nextBrick) || this.snake.fromFuture(nextBrick) < this.wallsFromSnake) {
                    isValid = false;
                    i++; 
                    break;
                } else {
                    wall.push(nextBrick);
                }
            }
            i++;
        } while(!isValid && i < 100)

        this.walls.push(wall);
    }

    generateBrick() {
        let i = 0;
        let xy;
        do {
            xy = this.randomXY();
            i++; // generate food until we don't hit anything, or we hit 100
        }
        while (this.hitBoundary(xy) && i < 100);
        return xy;
    }

    generateFood() {
        let i = 0;
        do {
            i++; // generate food until we don't hit anything, or we hit 100
            this.foodXY = this.randomXY();
        }
        while (this.hitBoundary(this.foodXY) || i == 100);
    }

    randomXY() {
        function rndAxis(max) {
            return Math.floor(Math.random() * max);
        }
        return new coordinate(rndAxis(this.xMax), rndAxis(this.yMax));
    }

    randomDirection() {
        let d = Math.floor(Math.random() * 4);
        switch (d) {
            case 0:
                return new coordinate(0, -1); // up
            case 1:
                return new coordinate(1, 0); // right
            case 2:
                return new coordinate(0, 1); // down
            case 3:
                return new coordinate(-1, 0); // left
        }
    }

    // for food or other object placement 
    hitBoundary(c) {
        if (c.x < this.xMin || c.x > this.xMax || c.y < this.yMin || c.y > this.yMax) {
            return true; // hit border
        } else if (this.snake.isIntersection(c)){
            return true; // hit self
        } else if (this.hitWall(c)){
            return true;
        }
        return false;
    }

    hitWall(c) {
        for (let i = 0; i < this.walls.length; i++) {
            let wall = this.walls[i];
            for (let j = 0; j < wall.length; j++) {
                if (wall[j].x == c.x && wall[j].y == c.y) return true;
            }
        }
        return false;
    }

    hitFood() {
        return this.snake.isIntersection(this.foodXY);
    }
}
