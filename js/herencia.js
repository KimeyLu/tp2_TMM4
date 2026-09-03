//modelo: sonnet 5 medio
//prompt: hola, estoy haciendo un sketch de p5js, en el que se generan 2 formas aleatorias en  2 rectangulos (A y B) del canvas, las podemos arrastrar con el mouse hacia un rectangulo C, y al arrastrarlas generan una forma que es el resultado de las caracteristicas de las formas anteriores, esa forma sale del rectangulo y se mueve en la linea y las otras desaparecen, si necesitas hacer cambios en la estructura de esto esta bien:

const Herencia = (p) => {
  //variables necesarias

  p.setup = function() {
    p.createCanvas(400, 400);
  }

  p.draw = function() {
    p.background('#970510');
    
    p.line(0, p.height/2, p.width, p.height/2); //linea que inicia en la mitad de la pantalla en el borde izquierdo del canvas y avanza horizontalmente hasta el borde derecho del canvas
    //DrawRectZones();
    //ParentShapesActions();
    //BornChildShape();
  }

  /*
  function DrawRectZones() {
    //los rectangulos son vacios, con un stroke de 4px, de color #F0D583
    //rect A
    p.rect(p.width/5, p.height/5, 50, 50);
    //rect C
    p.rect(p.width/2.3, p.height/4, 50, 50);
    //rect B
    p.rect(p.width/1.5, p.height/5, 50, 50);
  }

  function ParentShapesAction() {
    //aparecen 2 formas una en el rect A y la otra en el rect B, las formas tienen caracteristicas aleatorias (pueden ser triangulo isosceles, cuadrado, o circulo, y cualquiera podria combinarse con uno de estos dos colores: #F0D583 o #121212)
    //cuando cliqueamos una de las formas podemos arrastrarlas con el mouse
    //si las arrastramos hacia el rect C, se quedaran quietas en una posicion: Si la forma que estaba en rect A es arrastrada quedara en el lado izquierdo del rect C (x:150, y:128) Si la forma que estaba en rect B es arrastrada quedara en el lado derecho del rect C (x: 240, y:128)
    //se ejecuta BornChildShapes y las formas desaparecen, dejando lugar en los rect A y B para que entren nuevas formas
  }

  function BornChildShapes() {
    //se genera una nueva forma en base a las caracteristicas de las formas que fueron arrastradas (que antes estaban en los rect A y B), la nueva forma se generara dependiendo de el porcentaje de caracteristicas que hay en las dos formas (ej: si hay 2 rectangulos la forma hijo sera un rectangulo, si tienen colores diferentes se eligira el color con probabilidad de 50%)
    //una vez que se genere la forma: el hijo se mueve hacia la linea dibujada en el draw, y avanza hacia atras.
  }

  //funcion mousePressed con las caracteristicas necesarias 
  */
};

// 
new p5(Herencia, 'herencia');
