# Imagen del sitio web (nginx + páginas estáticas con soporte para variables de entorno)
FROM nginx:1.27-alpine

# Copiar la plantilla de Nginx a la ruta donde el script de inicio la procesa automáticamente
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

COPY proxy_comun.inc   /etc/nginx/conf.d/proxy_comun.inc
COPY index.html catalogo.html producto.html carrito.html checkout.html confirmacion.html \
     seguimiento.html login.html registro.html cuenta.html mayoristas.html ayuda.html admin.html 404.html \
     robots.txt sitemap.xml /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
