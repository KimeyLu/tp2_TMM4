// expandir.js
// Maneja el toque para abrir un signo en pantalla completa y su cierre.

document.addEventListener('DOMContentLoaded', () => {
  const items = document.querySelectorAll('.item');

  items.forEach(item => {
    // Botón de cerrar (se crea una sola vez por cada contenedor)
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '&times;';
    item.appendChild(closeBtn);

    // Tocar el contenedor lo expande (si ya está expandido, no hace nada)
    item.addEventListener('click', () => {
      if (item.classList.contains('expanded')) return;
      expandItem(item);
    });

    // El botón de cerrar SIEMPRE cierra, y frena el click para que no
    // vuelva a abrir el mismo contenedor
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseItem(item);
    });
  });

  // Cerrar con la tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const expanded = document.querySelector('.item.expanded');
      if (expanded) collapseItem(expanded);
    }
  });

  function expandItem(item) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('has-expanded'));
    item.classList.add('expanded');
    // Esperamos un frame (y un pelín más) para que el navegador termine de
    // ocultar la barra de direcciones / acomodar el viewport antes de medir.
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    });
  }

  function collapseItem(item) {
    item.classList.remove('expanded');
    document.querySelectorAll('.container').forEach(c => c.classList.remove('has-expanded'));
    window.dispatchEvent(new Event('resize'));
  }
});

// Función que cada sketch de p5 va a usar para saber qué tamaño de canvas
// le corresponde: pantalla completa si está expandido, o su tamaño normal.
window.getCanvasTargetSize = function (containerId, fallbackW, fallbackH) {
  const el = document.getElementById(containerId);
  const item = el && el.closest('.item');
  if (item && item.classList.contains('expanded')) {
    // visualViewport da el tamaño real visible en mobile (sin contar la
    // barra de direcciones/teclado), que innerWidth/innerHeight no siempre reflejan.
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    const maxSize = Math.min(w, h);
    return { w: maxSize, h: maxSize };
  }
  return { w: fallbackW, h: fallbackH };
};

// En mobile, mostrar/ocultar la barra de direcciones dispara cambios en
// visualViewport que no siempre generan un 'resize' normal de window.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (document.querySelector('.item.expanded')) {
      window.dispatchEvent(new Event('resize'));
    }
  });
}
