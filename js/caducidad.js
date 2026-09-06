const Caducidad = (p) => {
  // ---------- variables necesarias ----------
  let shape = null;
  const shapeTypes = ['triangle', 'square', 'circle'];
  const shapeColors = ['#F0D583', '#121212'];

  // tamaño base de la forma (a 400x400). El tamaño real (shapeSize) se
  // recalcula con computeSizeScale() para que se vea más grande en fullscreen.
  const BASE_SHAPE_SIZE = 24;
  const BASE_MAX_SHAKE = 6;
  let shapeSize;
  let maxShake;
  let SIZE_SCALE = 1;

  let pathStart, pathEnd;
  const fadeStart = 0.333;
  const fadeEnd = 0.75;

  let isDragging = false;
  let movingForward = false; // si el ultimo movimiento de arrastre fue hacia adelante

  const easeAtStart = 0.15; // que tan liviana es al principio del recorrido
  const easeAtEnd = 0.02;   // que tan pesada es cerca del final del recorrido

  const canvasRotation = -43; // grados de rotacion visual del canvas (solo estetico)

  const spawnFromX = -50;    // desde donde "viene" la forma nueva antes de llegar al inicio
  const spawnEase = 0.08;    // velocidad de la animacion de entrada

  let particles = [];             // particulas que caen de la forma mientras se arrastra hacia adelante
  const particleGravity = 0.15;
  const particleLife = 40;        // frames que dura cada particula

  function computeSizeScale() {
    const ratio = Math.min(p.width, p.height) / 400;
    return ratio <= 1 ? ratio : ratio * 1.25;
  }

  function computeSizes() {
    SIZE_SCALE = computeSizeScale();
    shapeSize = BASE_SHAPE_SIZE * SIZE_SCALE;
    maxShake = BASE_MAX_SHAKE * SIZE_SCALE;
  }

  p.setup = function() {
    p.createCanvas(400, 400);
    computeSizes();
    pathStart = 0;
    pathEnd = p.width;
    shape = createShape(pathStart);
  }

  p.windowResized = function() {
    const oldW = p.width;
    const { w, h } = window.getCanvasTargetSize('caducidad', 400, 400);
    p.resizeCanvas(w, h);

    const scaleX = p.width / oldW;
    computeSizes();
    pathEnd = p.width;

    if (shape) {
      shape.x *= scaleX;
      shape.maxX *= scaleX;
      shape.spawnTargetX *= scaleX;
      shape.y = p.height / 2;
    }
  }

  p.draw = function() {
    // el fondo se dibuja antes de rotar, para que siempre cubra todo el canvas
    p.background('#970510');

    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(canvasRotation));
    p.translate(-p.width / 2, -p.height / 2);

    //patron de fondo
    p.stroke('#F0D583');
    p.strokeWeight(4);
    p.line(p.width/3.4, p.height / 4.7, p.width/3.4, p.height / 2.5);
    p.strokeWeight(3);
    p.line(p.width/2, p.height / 4.7, p.width/2, p.height / 2.5);
    p.strokeWeight(2);
    p.line(p.width/1.4, p.height / 4.7, p.width/1.4, p.height / 2.5);

    // Línea de fondo
    p.stroke('#F0D583');
    p.strokeWeight(2);
    p.line(-100, p.height / 2, p.width + 100, p.height / 2);

    // Animacion de entrada, opacidad, particulas y dibujo
    UpdateSpawnAnimation();
    UpdateOpacity();
    EmitParticles();
    UpdateAndDrawParticles();
    DrawShape();

    // Verificar si la forma desapareció
    CheckAndRespawn();
  }

  // ---------- creación ----------
  function createShape(xPos) {
    return {
      type: p.random(shapeTypes),
      color: p.random(shapeColors),
      x: spawnFromX,       // arranca lejos, a la izquierda de la linea
      spawnTargetX: xPos,  // adonde tiene que llegar antes de poder ser interactuada
      isSpawning: true,
      y: p.height / 2,
      maxX: xPos,
      opacity: 255
    };
  }

  // ---------- animacion de entrada ----------
  function UpdateSpawnAnimation() {
    if (!shape || !shape.isSpawning) return;

    shape.x = p.lerp(shape.x, shape.spawnTargetX, spawnEase);

    if (Math.abs(shape.spawnTargetX - shape.x) < 0.5) {
      shape.x = shape.spawnTargetX;
      shape.isSpawning = false;
    }
  }

  // ---------- emitir particulas mientras se arrastra hacia adelante ----------
  function EmitParticles() {
    if (!shape || !isDragging || !movingForward) return;

    const progress = p.constrain((shape.x - pathStart) / (pathEnd - pathStart), 0, 1);
    const spawnProbability = p.lerp(0.15, 1, progress); // mas avance = mas particulas
    const particleSize = p.lerp(3 * SIZE_SCALE, 7 * SIZE_SCALE, progress); // tambien un poco mas grandes

    if (p.random() < spawnProbability) {
      particles.push({
        type: shape.type,
        color: shape.color,
        x: shape.x + p.random(-shapeSize / 4, shapeSize / 4),
        y: shape.y + shapeSize / 4,
        vx: p.random(-0.4, 0.4),
        vy: p.random(0.5, 1.5),
        size: particleSize,
        life: particleLife,
        maxLife: particleLife
      });
    }
  }

  // ---------- actualizar y dibujar particulas ----------
  function UpdateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];

      particle.vy += particleGravity;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;

      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = p.map(particle.life, 0, particle.maxLife, 0, 255);
      const c = p.color(particle.color);
      p.noStroke();
      p.fill(p.red(c), p.green(c), p.blue(c), alpha);

      if (particle.type === 'circle') {
        p.circle(particle.x, particle.y, particle.size);
      } else if (particle.type === 'square') {
        p.rectMode(p.CENTER);
        p.square(particle.x, particle.y, particle.size);
      } else if (particle.type === 'triangle') {
        const half = particle.size / 2;
        p.triangle(
          particle.x, particle.y - half,
          particle.x - half, particle.y + half,
          particle.x + half, particle.y + half
        );
      }
    }
  }

  // ---------- dibujar forma ----------
  function DrawShape() {
    if (!shape || shape.opacity <= 0) return;

    const c = p.color(shape.color);
    p.strokeWeight(3 * SIZE_SCALE);
    p.stroke(c);
    p.fill(p.red(c), p.green(c), p.blue(c), shape.opacity);

    // temblor: solo mientras se arrastra hacia adelante, cada vez mas fuerte segun el progreso
    let shakeX = 0, shakeY = 0;
    if (isDragging && movingForward) {
      const progress = p.constrain((shape.x - pathStart) / (pathEnd - pathStart), 0, 1);
      const shakeAmount = p.lerp(0, maxShake, progress);
      shakeX = p.random(-shakeAmount, shakeAmount);
      shakeY = p.random(-shakeAmount, shakeAmount);
    }

    const dx = shape.x + shakeX;
    const dy = shape.y + shakeY;

    if (shape.type === 'circle') {
      p.circle(dx, dy, shapeSize);
    } else if (shape.type === 'square') {
      p.rectMode(p.CENTER);
      p.square(dx, dy, shapeSize);
    } else if (shape.type === 'triangle') {
      const half = shapeSize / 2;
      p.triangle(
        dx, dy - half,
        dx - half, dy + half,
        dx + half, dy + half
      );
    }
  }

  // ---------- opacidad según recorrido ----------
  function UpdateOpacity() {
    if (!shape) return;

    const progress = p.constrain((shape.maxX - pathStart) / (pathEnd - pathStart), 0, 1);

    if (progress <= fadeStart) {
      shape.opacity = 255;
    } else if (progress >= fadeEnd) {
      shape.opacity = 0;
    } else {
      shape.opacity = p.map(progress, fadeStart, fadeEnd, 255, 0);
    }
  }

  // ---------- verificar y regenerar ----------
  function CheckAndRespawn() {
    if (!shape || shape.opacity <= 0) {
      // Generar nueva forma al inicio
      shape = createShape(pathStart);
      isDragging = false; // Resetear el estado de arrastre
    }
  }

  // ---------- traducir el mouse al espacio sin rotar ----------
  function getLogicalMouse() {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const theta = p.radians(canvasRotation);

    const dx = p.mouseX - cx;
    const dy = p.mouseY - cy;

    // rotacion inversa (-theta) alrededor del centro del canvas
    const x = dx * Math.cos(theta) + dy * Math.sin(theta) + cx;
    const y = -dx * Math.sin(theta) + dy * Math.cos(theta) + cy;

    return { x, y };
  }

  // ---------- interacción con el mouse ----------
  p.mousePressed = function() {
    const mouse = getLogicalMouse();
    if (shape && !shape.isSpawning && p.dist(mouse.x, mouse.y, shape.x, shape.y) < shapeSize / 2 + 4) {
      isDragging = true;
    }
  }

  p.mouseDragged = function() {
    if (isDragging && shape) {
      const mouse = getLogicalMouse();
      const targetX = p.constrain(mouse.x, pathStart, pathEnd);

      if (targetX > shape.x) {
        // hacia adelante: cuanto mas avanzo en el recorrido, mas "pesada" se pone
        movingForward = true;
        const progress = p.constrain((shape.x - pathStart) / (pathEnd - pathStart), 0, 1);
        const forwardEase = p.lerp(easeAtStart, easeAtEnd, progress);
        shape.x = p.lerp(shape.x, targetX, forwardEase);
      } else {
        // hacia atras: sin resistencia, se mueve normal, y sin temblor
        movingForward = false;
        shape.x = targetX;
      }

      shape.maxX = Math.max(shape.maxX, shape.x);
    }
  }

  p.mouseReleased = function() {
    isDragging = false;
    movingForward = false;
  }
};

// Instanciación
new p5(Caducidad, 'caducidad');