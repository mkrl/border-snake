type Point = {
  x: number
  y: number
}

const boardSize = 20
const keyboardTickLength = 115
const touchTickLength = 170
const swipeThreshold = 18
const gameElement = document.querySelector<HTMLDivElement>('div')

if (!gameElement) {
  throw new Error('The snake game element is missing.')
}

const game = gameElement

const directions: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

let snake: Point[]
let direction: Point
let queuedDirection: Point
let food: Point
let score: number
let playing: boolean
let awaitingStart: boolean
let lastTick = 0
let tickLength = keyboardTickLength
let touchStart: Point | undefined

function samePoint(first: Point, second: Point) {
  return first.x === second.x && first.y === second.y
}

function placeFood(): Point {
  const available: Point[] = []

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const point = { x, y }
      if (!snake.some((segment) => samePoint(segment, point))) {
        available.push(point)
      }
    }
  }

  return available[Math.floor(Math.random() * available.length)]
}

function snakePath() {
  const cellSize = game.getBoundingClientRect().width / boardSize

  return snake
    .map(
      (segment, index) =>
        `${index === 0 ? 'M' : 'L'} ${(segment.x + 0.5) * cellSize} ${(segment.y + 0.5) * cellSize}`,
    )
    .join(' ')
}

function render(message = `Score ${score} · Swipe or use arrow keys`) {
  const cellSize = game.getBoundingClientRect().width / boardSize

  game.style.setProperty('border-shape', `path("${snakePath()}")`)
  game.style.setProperty('--food-left', `${(food.x + 0.5) * cellSize}px`)
  game.style.setProperty('--food-top', `${(food.y + 0.5) * cellSize}px`)
  game.dataset.status = message
  game.setAttribute('aria-label', `Border-shape snake game. ${message}`)
}

function reset(startImmediately = false, startedByTouch = false) {
  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]
  direction = { x: 1, y: 0 }
  queuedDirection = direction
  score = 0
  playing = startImmediately
  awaitingStart = !startImmediately
  tickLength = startedByTouch ? touchTickLength : keyboardTickLength
  if (startImmediately) {
    lastTick = performance.now()
  }
  food = placeFood()
  render(
    startImmediately
      ? `Score ${score} · Swipe or use arrow keys`
      : 'Tap or press an arrow key to start',
  )
}

function endGame(message: string) {
  playing = false
  awaitingStart = false
  render(`${message} · Tap or press Enter to play again`)
}

function startGame(startedByTouch: boolean) {
  playing = true
  awaitingStart = false
  tickLength = startedByTouch ? touchTickLength : keyboardTickLength
  lastTick = performance.now()
  render()
}

function queueDirection(nextDirection: Point) {
  if (
    nextDirection.x !== -direction.x ||
    nextDirection.y !== -direction.y
  ) {
    queuedDirection = nextDirection
  }
}

function update() {
  direction = queuedDirection
  const head = snake[0]
  const next = { x: head.x + direction.x, y: head.y + direction.y }
  const ateFood = samePoint(next, food)
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1)

  if (
    next.x < 0 ||
    next.x >= boardSize ||
    next.y < 0 ||
    next.y >= boardSize ||
    bodyToCheck.some((segment) => samePoint(segment, next))
  ) {
    endGame(`Game over · Score ${score}`)
    return
  }

  snake.unshift(next)
  if (ateFood) {
    score += 1
    if (snake.length === boardSize * boardSize) {
      endGame(`You filled the board · Score ${score}`)
      return
    }
    food = placeFood()
  } else {
    snake.pop()
  }

  render()
}

function frame(timestamp: number) {
  if (playing && timestamp - lastTick >= tickLength) {
    lastTick = timestamp
    update()
  }
  requestAnimationFrame(frame)
}

document.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const nextDirection = directions[key]

  if (key === 'Enter' && !playing) {
    reset(true)
    return
  }

  if (!nextDirection) {
    return
  }

  event.preventDefault()
  if (!playing) {
    if (!awaitingStart) {
      return
    }
    startGame(false)
  }
  queueDirection(nextDirection)
})

game.addEventListener(
  'touchstart',
  (event) => {
    const touch = event.changedTouches[0]
    if (touch) {
      touchStart = { x: touch.clientX, y: touch.clientY }
    }
  },
  { passive: true },
)

game.addEventListener(
  'touchend',
  (event) => {
    const touch = event.changedTouches[0]
    const start = touchStart
    touchStart = undefined

    if (!touch || !start) {
      return
    }

    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = touch.clientY - start.y

    if (
      Math.abs(horizontalDistance) < swipeThreshold &&
      Math.abs(verticalDistance) < swipeThreshold
    ) {
      if (awaitingStart) {
        startGame(true)
      } else if (!playing) {
        reset(true, true)
      }
      return
    }

    if (!playing) {
      return
    }

    if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) {
      queueDirection({ x: horizontalDistance > 0 ? 1 : -1, y: 0 })
    } else {
      queueDirection({ x: 0, y: verticalDistance > 0 ? 1 : -1 })
    }
  },
  { passive: true },
)

game.addEventListener(
  'touchcancel',
  () => {
    touchStart = undefined
  },
  { passive: true },
)

reset()
new ResizeObserver(() => render()).observe(game)
requestAnimationFrame(frame)
