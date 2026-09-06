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
    window.dispatchEvent(new Event('resize'));
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
    return { w: window.innerWidth, h: window.innerHeight };
  }
  return { w: fallbackW, h: fallbackH };
};