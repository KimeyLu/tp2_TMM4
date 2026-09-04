const Caducidad = (p) => {

  let triX, triY;
  let TRI_X_INICIAL, TRI_Y_INICIAL;
  let arrastrando = false;

  let cuadrados = [];

  // definición proporcional de los 4 cuadrados anidados (fracción del
  // ancho/alto del canvas), para poder recalcularlos si el canvas cambia
  // de tamaño (por ejemplo, al abrir el signo en pantalla completa)
  const CUADRADOS_DEF = [
    { l: 0.25,  t: 0.25,  r: 0.75,  b: 0.75  },
    { l: 0.225, t: 0.225, r: 0.775, b: 0.775 },
    { l: 0.20,  t: 0.20,  r: 0.80,  b: 0.80  },
    { l: 0.175, t: 0.175, r: 0.825, b: 0.825 }
  ];

  const TRI_ABAJO = 30;
  const TRI_ANCHO = 20;

  let bordeTocado = null;
  let tiempoInicioToque = 0;
  const TIEMPO_LIMITE = 3000;
  const TIEMPO_REGENERACION = 10000;

  let triHealth = 100;
  const TRI_HEALTH_MAX = 100;

  const ANGULO_ROTACION = 45; // grados

  function pantallaARotado(px, py) {
    const cx = p.width / 2, cy = p.height / 2;
    const ang = p.radians(-ANGULO_ROTACION);
    const dx = px - cx;
    const dy = py - cy;
    const rx = dx * p.cos(ang) - dy * p.sin(ang);
    const ry = dx * p.sin(ang) + dy * p.cos(ang);
    return { x: rx + cx, y: ry + cy };
  }

  let particulas = [];
  let contadorSpawn = 0;
  const INTERVALO_SPAWN = 6;

  const FLOTE_AMP_X = 3;
  const FLOTE_AMP_Y = 5;
  const FLOTE_VEL_X = 0.0018;
  const FLOTE_VEL_Y = 0.0024;

  function calcularFlote() {
    if (arrastrando) {
      return { dx: 0, dy: 0 };
    }
    return {
      dx: p.sin(p.millis() * FLOTE_VEL_X) * FLOTE_AMP_X,
      dy: p.cos(p.millis() * FLOTE_VEL_Y) * FLOTE_AMP_Y
    };
  }

  class Particula {
    constructor(x, y) {
      this.x = x + p.random(-5, 5);
      this.y = y + p.random(-5, 5);
      this.tam = p.random(4, 8);
      this.vy = p.random(1, 2.5);
      this.vx = p.random(-0.5, 0.5);
      this.alpha = 255;
      this.desvanecimiento = p.random(3, 6);
    }
    actualizar() {
      this.y += this.vy;
      this.x += this.vx;
      this.alpha -= this.desvanecimiento;
    }
    estaViva() {
      return this.alpha > 0;
    }
    dibujar() {
      p.push();
        p.noStroke();
        p.fill(0, 0, 0, this.alpha);
        p.triangle(
          this.x, this.y,
          this.x - this.tam / 2, this.y + this.tam,
          this.x + this.tam / 2, this.y + this.tam
        );
      p.pop();
    }
  }

  function emitirParticulas(x, y, cantidad = 5) {
    for (let i = 0; i < cantidad; i++) {
      particulas.push(new Particula(x, y));
    }
  }

  function actualizarYDibujarParticulas() {
    for (let i = particulas.length - 1; i >= 0; i--) {
      particulas[i].actualizar();
      particulas[i].dibujar();
      if (!particulas[i].estaViva()) {
        particulas.splice(i, 1);
      }
    }
  }

  class Cuadrado {
    constructor(izq, arriba, der, abajo) {
      this.izq = izq;
      this.arriba = arriba;
      this.der = der;
      this.abajo = abajo;
      this.rotoArriba = false;
      this.rotoIzq = false;
      this.rotoDer = false;
      this.rotoAbajo = false;
      this.alphaArriba = 255;
      this.alphaIzq = 255;
      this.alphaDer = 255;
      this.alphaAbajo = 255;
      this.tiempoRoturaArriba = null;
      this.tiempoRoturaIzq = null;
      this.tiempoRoturaDer = null;
      this.tiempoRoturaAbajo = null;
    }
    dibujar() {
      p.push();
        if (!this.rotoArriba) {
          p.stroke(239, 212, 131, this.alphaArriba);
          p.line(this.izq, this.arriba, this.der, this.arriba);
        }
        if (!this.rotoIzq) {
          p.stroke(239, 212, 131, this.alphaIzq);
          p.line(this.izq, this.arriba, this.izq, this.abajo);
        }
        if (!this.rotoDer) {
          p.stroke(239, 212, 131, this.alphaDer);
          p.line(this.der, this.arriba, this.der, this.abajo);
        }
        if (!this.rotoAbajo) {
          p.stroke(239, 212, 131, this.alphaAbajo);
          p.line(this.izq, this.abajo, this.der, this.abajo);
        }
      p.pop();
    }
    resetAlpha(lado) {
      if (lado === 'arriba') this.alphaArriba = 255;
      if (lado === 'izq')    this.alphaIzq = 255;
      if (lado === 'der')    this.alphaDer = 255;
      if (lado === 'abajo')  this.alphaAbajo = 255;
    }
    setAlpha(lado, valor) {
      if (lado === 'arriba') this.alphaArriba = valor;
      if (lado === 'izq')    this.alphaIzq = valor;
      if (lado === 'der')    this.alphaDer = valor;
      if (lado === 'abajo')  this.alphaAbajo = valor;
    }
    romper(lado) {
      if (lado === 'arriba') { this.rotoArriba = true; this.tiempoRoturaArriba = p.millis(); }
      if (lado === 'izq')    { this.rotoIzq = true;    this.tiempoRoturaIzq = p.millis(); }
      if (lado === 'der')    { this.rotoDer = true;    this.tiempoRoturaDer = p.millis(); }
      if (lado === 'abajo')  { this.rotoAbajo = true;  this.tiempoRoturaAbajo = p.millis(); }
    }
    regenerar(lado) {
      if (lado === 'arriba') { this.rotoArriba = false; this.tiempoRoturaArriba = null; this.alphaArriba = 255; }
      if (lado === 'izq')    { this.rotoIzq = false;    this.tiempoRoturaIzq = null;    this.alphaIzq = 255; }
      if (lado === 'der')    { this.rotoDer = false;    this.tiempoRoturaDer = null;    this.alphaDer = 255; }
      if (lado === 'abajo')  { this.rotoAbajo = false;  this.tiempoRoturaAbajo = null;  this.alphaAbajo = 255; }
    }
    actualizarRegeneracion() {
      const ahora = p.millis();
      if (this.rotoArriba && ahora - this.tiempoRoturaArriba >= TIEMPO_REGENERACION) this.regenerar('arriba');
      if (this.rotoIzq    && ahora - this.tiempoRoturaIzq    >= TIEMPO_REGENERACION) this.regenerar('izq');
      if (this.rotoDer    && ahora - this.tiempoRoturaDer    >= TIEMPO_REGENERACION) this.regenerar('der');
      if (this.rotoAbajo  && ahora - this.tiempoRoturaAbajo  >= TIEMPO_REGENERACION) this.regenerar('abajo');
    }
  }

  function computeCuadrados() {
    if (cuadrados.length === 0) {
      for (const d of CUADRADOS_DEF) {
        cuadrados.push(new Cuadrado(
          p.width * d.l, p.height * d.t, p.width * d.r, p.height * d.b
        ));
      }
    } else {
      cuadrados.forEach((c, i) => {
        const d = CUADRADOS_DEF[i];
        c.izq = p.width * d.l;
        c.arriba = p.height * d.t;
        c.der = p.width * d.r;
        c.abajo = p.height * d.b;
      });
    }
  }

  function computeTriangleInit() {
    TRI_X_INICIAL = p.width * 0.5;
    TRI_Y_INICIAL = p.height * 0.375;
  }

  p.setup = function () {
    p.createCanvas(400, 400);
    computeTriangleInit();
    triX = TRI_X_INICIAL;
    triY = TRI_Y_INICIAL;
    computeCuadrados();
  };

  p.windowResized = function () {
    const oldW = p.width, oldH = p.height;
    const { w, h } = window.getCanvasTargetSize('caducidad', 400, 400);
    p.resizeCanvas(w, h);

    const scaleX = p.width / oldW;
    const scaleY = p.height / oldH;

    computeCuadrados();
    computeTriangleInit();
    triX *= scaleX;
    triY *= scaleY;
  };

  p.draw = function () {
    p.background(151, 5, 16);
    p.strokeWeight(4);
    p.strokeCap(p.SQUARE);

    p.push();
      p.translate(p.width / 2, p.height / 2);
      p.rotate(p.radians(ANGULO_ROTACION));
      p.translate(-p.width / 2, -p.height / 2);

      for (const c of cuadrados) {
        c.actualizarRegeneracion();
        c.dibujar();
      }

      const alphaTriangulo = p.map(triHealth, 0, TRI_HEALTH_MAX, 0, 255);
      const flote = calcularFlote();
      p.push();
        p.stroke(18, 18, 18, alphaTriangulo);
        p.fill(18, 18, 18, alphaTriangulo);
        p.triangle(
          triX + flote.dx, triY + flote.dy,
          triX - TRI_ANCHO + flote.dx, triY + TRI_ABAJO + flote.dy,
          triX + TRI_ANCHO + flote.dx, triY + TRI_ABAJO + flote.dy
        );
      p.pop();

      if (arrastrando) {
        verificarToqueYDanio();

        const centroX = triX;
        const centroY = (triY + (triY + TRI_ABAJO) + (triY + TRI_ABAJO)) / 3;
        p.push();
          p.stroke(18, 18, 18);
          p.strokeWeight(2);
          p.line(centroX, centroY, p.width / 2, -p.height/2);
        p.pop();
      }

      actualizarYDibujarParticulas();

      p.push();
        p.fill(0, 0, 0, 0);
        p.stroke(30, 30, 30);
        p.strokeWeight(4);
        p.rect(70, -60, 260, 10);
        p.rect(90, -80, 220, 10);

        
        p.rect(80, p.height+50, 240, 10);
        p.rect(90, p.height+40, 220, 30);
      p.pop();
    p.pop();
  };

  function calcularLimites() {
    let minX = -Infinity, cuadIzq = null;
    let maxX = Infinity,  cuadDer = null;
    let minY = -Infinity, cuadArriba = null;
    let maxY = Infinity,  cuadAbajo = null;

    for (const c of cuadrados) {
      if (!c.rotoIzq) {
        const val = c.izq + TRI_ANCHO;
        if (val > minX) { minX = val; cuadIzq = c; }
      }
      if (!c.rotoDer) {
        const val = c.der - TRI_ANCHO;
        if (val < maxX) { maxX = val; cuadDer = c; }
      }
      if (!c.rotoArriba) {
        const val = c.arriba;
        if (val > minY) { minY = val; cuadArriba = c; }
      }
      if (!c.rotoAbajo) {
        const val = c.abajo - TRI_ABAJO;
        if (val < maxY) { maxY = val; cuadAbajo = c; }
      }
    }

    return { minX, maxX, minY, maxY, cuadIzq, cuadDer, cuadArriba, cuadAbajo };
  }

  function verificarToqueYDanio() {
    const lim = calcularLimites();

    let objetivo = null;
    if (triY <= lim.minY && lim.cuadArriba) objetivo = { cuadrado: lim.cuadArriba, lado: 'arriba' };
    else if (triY >= lim.maxY && lim.cuadAbajo) objetivo = { cuadrado: lim.cuadAbajo, lado: 'abajo' };
    else if (triX <= lim.minX && lim.cuadIzq) objetivo = { cuadrado: lim.cuadIzq, lado: 'izq' };
    else if (triX >= lim.maxX && lim.cuadDer) objetivo = { cuadrado: lim.cuadDer, lado: 'der' };

    if (objetivo === null) {
      if (bordeTocado !== null) bordeTocado.cuadrado.resetAlpha(bordeTocado.lado);
      bordeTocado = null;
      triHealth = TRI_HEALTH_MAX;
      return;
    }

    const esElMismo = bordeTocado
      && bordeTocado.cuadrado === objetivo.cuadrado
      && bordeTocado.lado === objetivo.lado;

    if (!esElMismo) {
      if (bordeTocado !== null) bordeTocado.cuadrado.resetAlpha(bordeTocado.lado);
      bordeTocado = objetivo;
      tiempoInicioToque = p.millis();
    }

    const transcurrido = p.millis() - tiempoInicioToque;
    const progreso = p.constrain(transcurrido / TIEMPO_LIMITE, 0, 1);

    bordeTocado.cuadrado.setAlpha(bordeTocado.lado, p.map(progreso, 0, 1, 255, 0));
    triHealth = p.map(progreso, 0, 1, TRI_HEALTH_MAX, 0);

    contadorSpawn++;
    if (contadorSpawn >= INTERVALO_SPAWN) {
      emitirParticulas(triX, triY + TRI_ABAJO / 2, 5);
      contadorSpawn = 0;
    }

    if (progreso >= 1) {
      romperBordeYReiniciarTriangulo();
    }
  }

  function romperBordeYReiniciarTriangulo() {
    bordeTocado.cuadrado.romper(bordeTocado.lado);

    triX = TRI_X_INICIAL;
    triY = TRI_Y_INICIAL;
    triHealth = TRI_HEALTH_MAX;
    bordeTocado = null;
    arrastrando = false;
  }

  p.mousePressed = function () {
    const m = pantallaARotado(p.mouseX, p.mouseY);
    if (p.dist(m.x, m.y, triX, triY + 20) < 30) {
      arrastrando = true;
    }
  };

  p.mouseDragged = function () {
    if (!arrastrando) return;
    const m = pantallaARotado(p.mouseX, p.mouseY);
    const lim = calcularLimites();
    triX = p.constrain(m.x, lim.minX, lim.maxX);
    triY = p.constrain(m.y - 20, lim.minY, lim.maxY);
  };

  p.mouseReleased = function () {
    arrastrando = false;
    if (bordeTocado !== null) {
      bordeTocado.cuadrado.resetAlpha(bordeTocado.lado);
      bordeTocado = null;
    }
    triHealth = TRI_HEALTH_MAX;
  };
};

// Instanciación: 'caducidad' es el id del div donde va este canvas
new p5(Caducidad, 'caducidad');