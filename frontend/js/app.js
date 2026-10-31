/* ============================================================
   Detalles Eternos GT · Núcleo del sitio
   1. Utilidades de formato        6. Carrito (localStorage)
   2. Almacenamiento y sesión      7. Componentes visuales
   3. Reglas de negocio (RN)       8. Cabecera, pie y navegación
   4. Modo demo (sin servidor)     9. Arranque de cada página
   5. Modo API (backend real)
   Todo queda en window.DE para que cada página lo use.
   ============================================================ */
(function () {
  'use strict';
  const CONFIG = window.DE_CONFIG;
  const R = CONFIG.REGLAS;
  const DE = (window.DE = {});

  /* ============================================================
     1. UTILIDADES DE FORMATO
     ============================================================ */
  // Formato del negocio: "Q1,250.00" (sin espacio; algunos navegadores lo agregan con el formato de moneda estándar).
  const formatoQ = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  DE.dinero = (n) => { const v = Number(n) || 0; return (v < 0 ? '-Q' : 'Q') + formatoQ.format(Math.abs(v)); };
  DE.redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  DE.fecha = (iso, conHora) => {
    if (!iso) return '';
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    if (conHora) Object.assign(opciones, { hour: 'numeric', minute: '2-digit' });
    return new Date(iso).toLocaleDateString('es-GT', opciones);
  };
  DE.numeroPedido = (id) => 'DE-' + String(id).padStart(6, '0');
  DE.esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DE.$ = (sel, raiz = document) => raiz.querySelector(sel);
  DE.$$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
  DE.param = (nombre) => new URLSearchParams(location.search).get(nombre);
  DE.normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ============================================================
     2. ALMACENAMIENTO Y SESIÓN
     ============================================================ */
  const almacen = {
    leer(clave, porDefecto) {
      try { const v = localStorage.getItem(clave); return v === null ? porDefecto : JSON.parse(v); }
      catch { return porDefecto; }
    },
    guardar(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado */ } },
    borrar(clave) { try { localStorage.removeItem(clave); } catch { /* nada */ } },
  };
  DE.almacen = almacen;

  DE.sesion = {
    obtener() { const s = almacen.leer('de_sesion', null); return s && s.token && s.usuario ? s : null; },
    guardar(token, usuario) { almacen.guardar('de_sesion', { token, usuario }); },
    actualizarUsuario(usuario) { const s = this.obtener(); if (s) this.guardar(s.token, { ...s.usuario, ...usuario }); },
    cerrar() { almacen.borrar('de_sesion'); },
    /** Si no hay sesión, manda al login y regresa aquí después. */
    requerir(rol) {
      const s = this.obtener();
      if (!s) { location.href = 'login.html?volver=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return null; }
      if (rol && s.usuario.rol !== rol) { location.href = 'index.html'; return null; }
      return s;
    },
  };

  /* ============================================================
     3. REGLAS DE NEGOCIO
     ============================================================ */
  DE.CATEGORIAS = {
    carteras: { nombre: 'Carteras', corto: 'Carteras', icono: 'i-bolsa', color: '#C2185B' },
    belleza:  { nombre: 'Belleza y maquillaje', corto: 'Belleza', icono: 'i-paleta', color: '#2B3A8C' },
    hogar:    { nombre: 'Hogar y limpieza', corto: 'Hogar y limpieza', icono: 'i-limpieza', color: '#0B6E4F' },
    dulceria: { nombre: 'Dulcería mexicana', corto: 'Dulcería', icono: 'i-dulce', color: '#9E1249' },
    cafe:     { nombre: 'Café', corto: 'Café', icono: 'i-cafe', color: '#6B3A1F' },
    regalos:  { nombre: 'Regalos y canastas', corto: 'Regalos', icono: 'i-regalo', color: '#2A1E17' },
  };
  DE.categoria = (clave) => DE.CATEGORIAS[clave] || DE.CATEGORIAS.regalos;

  DE.ENTREGAS = {
    domicilio: { nombre: 'Envío a domicilio', detalle: 'A todo el país con Cargo Expreso, GuateExpres o Forza Delivery' },
    expres: { nombre: 'Envío exprés local', detalle: 'Ciudad de Guatemala y municipios cercanos, en el mismo día o al siguiente' },
    tienda: { nombre: 'Recoger en tienda', detalle: 'Gratis en nuestra tienda de zona 18' },
  };
  DE.PAGOS = {
    tarjeta: 'Tarjeta de crédito o débito',
    transferencia: 'Transferencia bancaria',
    contra_entrega: 'Pago contra entrega',
  };
  DE.ESTADOS = {
    PENDIENTE: 'Pendiente de pago',
    PAGADO: 'Pagado',
    EN_PREPARACION: 'En preparación',
    ENVIADO: 'Enviado',
    LISTO_PARA_RECOGER: 'Listo para recoger',
    ENTREGADO: 'Entregado',
    CANCELADO: 'Cancelado',
  };
  DE.ROLES = { cliente: 'Cliente', mayorista: 'Mayorista', admin: 'Administrador' };
  DE.DEPARTAMENTOS = ['Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla', 'Guatemala',
    'Huehuetenango', 'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez',
    'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'];
  DE.MUNICIPIOS_GUATEMALA = ['Guatemala', 'Mixco', 'Villa Nueva', 'Chinautla', 'San Pedro Ayampuc', 'Santa Catarina Pinula',
    'San José Pinula', 'Villa Canales', 'San Miguel Petapa', 'Fraijanes', 'Amatitlán', 'Palencia', 'San José del Golfo',
    'San Pedro Sacatepéquez', 'San Juan Sacatepéquez', 'San Raymundo', 'Chuarrancho'];

  DE.TEXTOS = {
    perecedero: 'Producto perecedero: solo se entrega con Recogida en tienda o Envío exprés local (Ciudad de Guatemala y municipios cercanos). No se envía a departamentos lejanos.',
    perecederoCorto: 'Perecedero: recogida o exprés local',
    liquido: 'Líquido o aerosol: tiene restricciones para envío departamental. Algunas mensajerías no lo transportan fuera de la capital o requiere empaque especial.',
    liquidoCorto: 'Líquido: envío con restricciones',
    empaque: 'Presentación premium: caja rígida con papel de china de colores, moño de listón y tarjeta con tu mensaje escrito a mano.',
  };

  DE.stockEstado = (p) => {
    if (p.stock <= 0) return { clase: 'agotado', texto: 'Agotado' };
    if (p.stock <= R.stockBajo) return { clase: 'bajo', texto: `Quedan ${p.stock}` };
    return { clase: 'ok', texto: 'Disponible' };
  };

  /** Precio que paga un cliente según su tipo y la cantidad (RF-13). */
  DE.precioPara = (p, cantidad, rol) => {
    const mayorista = rol === 'mayorista' && p.precio_mayorista && cantidad >= (p.minimo_mayorista || 1);
    return { precio: Number(mayorista ? p.precio_mayorista : p.precio), mayorista: !!mayorista };
  };

  /**
   * Calcula totales, envío y avisos de un pedido aplicando RN-01 a RN-04.
   * En modo 'api' el backend debe devolver exactamente esta misma estructura (POST /pedidos/pedidos/cotizar).
   */
  DE.cotizar = ({ items, entrega = '', departamento = '', municipio = '', empaque_regalo = false }, productos, rol) => {
    const cantidades = new Map();
    items.forEach((i) => cantidades.set(i.producto_id, (cantidades.get(i.producto_id) || 0) + i.cantidad));
    const lineas = [], errores = [], avisos = [];
    let subtotal = 0, peso = 0, hayPerecederos = false, hayLiquidos = false;

    cantidades.forEach((cantidad, id) => {
      const p = productos[id];
      if (!p || p.activo === false) { errores.push('Un producto de tu carrito ya no está disponible.'); return; }
      if (p.stock <= 0) errores.push(`«${p.nombre}» está agotado.`);                        // RN-01
      else if (p.stock < cantidad) errores.push(`Solo quedan ${p.stock} unidades de «${p.nombre}».`);
      const { precio, mayorista } = DE.precioPara(p, cantidad, rol);
      const linea = DE.redondear(precio * cantidad);
      subtotal += linea; peso += Number(p.peso_lb || 0) * cantidad;
      hayPerecederos = hayPerecederos || p.tipo === 'perecedero';
      hayLiquidos = hayLiquidos || p.tipo === 'liquido';
      lineas.push({ producto_id: p.id, nombre: p.nombre, categoria: p.categoria, tipo: p.tipo, imagen_url: p.imagen_url || '',
        cantidad, stock: p.stock, precio_unitario: precio, precio_normal: Number(p.precio), precio_mayorista_aplicado: mayorista,
        subtotal: linea, peso_lb: Number(p.peso_lb || 0) });
    });
    subtotal = DE.redondear(subtotal); peso = DE.redondear(peso);

    const local = departamento === 'Guatemala' && R.municipiosExpres.map(DE.normalizar).includes(DE.normalizar(municipio));
    const permitidas = ['tienda'];
    if (local || !departamento) permitidas.push('expres');
    if (!hayPerecederos) permitidas.push('domicilio');                                       // RN-03
    if (hayPerecederos) avisos.push({ tipo: 'perecedero', texto: 'Tu pedido tiene productos perecederos (dulces o café): solo puedes elegir Recoger en tienda o Envío exprés local.' });
    if (hayLiquidos && entrega === 'domicilio' && departamento && departamento !== 'Guatemala')    // RN-02
      avisos.push({ tipo: 'liquido', texto: 'Tu pedido tiene líquidos o aerosoles y va a otro departamento: pueden aplicar restricciones de la mensajería o un tiempo de entrega mayor.' });
    else if (hayLiquidos && !entrega) avisos.push({ tipo: 'liquido', texto: 'Tu pedido tiene líquidos o aerosoles, con restricciones para envío departamental.' });
    if (entrega === 'expres' && departamento && !local) errores.push('El envío exprés solo llega a la Ciudad de Guatemala y municipios cercanos.');
    else if (entrega === 'domicilio' && hayPerecederos) errores.push('Los productos perecederos no se envían a domicilio nacional. Elige Recoger en tienda o Envío exprés local.');

    let envio = 0, envioGratis = false;                                                     // RN-04
    const califica = subtotal > R.envioGratisDesde && peso <= R.envioGratisMaxLb;
    if (entrega === 'domicilio') {
      if (califica) envioGratis = true;
      else envio = R.tarifaDomicilio + Math.max(0, Math.ceil(peso - R.lbIncluidas)) * R.tarifaLbExtra;
    } else if (entrega === 'expres') envio = R.tarifaExpres;
    const cargoEmpaque = empaque_regalo ? R.cargoEmpaqueRegalo : 0;
    const total = DE.redondear(subtotal + envio + cargoEmpaque);

    return {
      lineas, subtotal, peso_lb: peso, envio, envio_gratis: envioGratis, cargo_empaque: cargoEmpaque, total,
      entregas_permitidas: permitidas, avisos, errores,
      califica_envio_gratis: califica,
      faltante_envio_gratis: subtotal > R.envioGratisDesde ? 0 : DE.redondear(R.envioGratisDesde - subtotal + 0.01),
      puntos_estimados: Math.floor(subtotal / R.puntosCadaQ),
    };
  };

  /** Filtra, ordena y pagina productos (lo usa el modo demo y como respaldo en modo API). */
  DE.filtrarProductos = (lista, f = {}) => {
    const cats = [].concat(f.categoria || []).flatMap((c) => String(c).split(',')).filter(Boolean);
    const ids = f.ids ? String(f.ids).split(',').map(Number) : null;
    const q = DE.normalizar(f.q);
    let r = lista.filter((p) => p.activo !== false);
    if (ids) r = r.filter((p) => ids.includes(p.id));
    if (q) r = r.filter((p) => DE.normalizar(p.nombre + ' ' + p.descripcion).includes(q));
    if (cats.length) r = r.filter((p) => cats.includes(p.categoria));
    if (f.min !== undefined && f.min !== '' && f.min !== null) r = r.filter((p) => p.precio >= Number(f.min));
    if (f.max !== undefined && f.max !== '' && f.max !== null) r = r.filter((p) => p.precio <= Number(f.max));
    if (f.disponibles) r = r.filter((p) => p.stock > 0);
    if (f.envio_nacional) r = r.filter((p) => p.tipo === 'normal');
    if (f.destacado) r = r.filter((p) => p.destacado);
    if (f.con_mayorista) r = r.filter((p) => p.precio_mayorista);
    const orden = {
      vendidos: (a, b) => b.ventas - a.ventas,
      precio_asc: (a, b) => a.precio - b.precio,
      precio_desc: (a, b) => b.precio - a.precio,
      nuevos: (a, b) => b.id - a.id,
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    }[f.orden || 'vendidos'] || ((a, b) => b.ventas - a.ventas);
    r.sort(orden);
    const porPagina = Number(f.por_pagina) || R.productosPorPagina;
    const paginas = Math.max(1, Math.ceil(r.length / porPagina));
    const pagina = Math.min(Math.max(1, Number(f.pagina) || 1), paginas);
    return { total: r.length, pagina, paginas, por_pagina: porPagina, data: r.slice((pagina - 1) * porPagina, pagina * porPagina) };
  };

  /** Completa campos que el backend actual todavía no tiene, para que el sitio no se rompa. */
  const completarProducto = (p) => ({
    descripcion: '', categoria: 'regalos', precio_mayorista: null, minimo_mayorista: 12, peso_lb: 1, tipo: 'normal',
    destacado: false, imagen_url: '', ventas: 0, activo: true, ...p, precio: Number(p.precio), stock: Number(p.stock ?? 0),
  });

  /* ============================================================
     4. MODO DEMO: simula el backend dentro del navegador
     ============================================================ */
  class ErrorTienda extends Error {
    constructor(mensaje, estado = 400) { super(mensaje); this.estado = estado; }
  }
  DE.ErrorTienda = ErrorTienda;

  async function cifrar(texto) {
    if (window.crypto && crypto.subtle) {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
      return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return 'fnv' + (h >>> 0).toString(16);
  }
  const tokenAleatorio = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('');

  const Demo = {
    _db: null,
    async db() {
      if (this._db) return this._db;
      let db = almacen.leer('de_demo_db', null);
      if (!db || db.version !== window.DE_DEMO.version) db = await this.crearBase();
      this._db = db;
      return db;
    },
    guardar() { almacen.guardar('de_demo_db', this._db); },
    async crearBase() {
      const D = window.DE_DEMO;
      const ahora = Date.now();
      const productos = D.productos.map((p, i) => completarProducto({ ...p, activo: true, creado_en: new Date(ahora - (D.productos.length - i) * 86400000).toISOString() }));
      const usuarios = [];
      for (const u of D.usuarios) {
        const sal = tokenAleatorio().slice(0, 16);
        const { password, ...resto } = u;
        usuarios.push({ ...resto, sal, password_hash: await cifrar(sal + password), creado_en: new Date(ahora - 30 * 86400000).toISOString() });
      }
      const mapa = Object.fromEntries(productos.map((p) => [p.id, { ...p, stock: 999 }]));
      const pedidos = D.pedidos.map((pd) => {
        const rol = usuarios.find((u) => u.id === pd.usuario_id)?.rol;
        const c = DE.cotizar(pd, mapa, rol);
        const fecha = new Date(ahora - pd.dias * 86400000 - 3600000).toISOString();
        const { dias, ...datos } = pd;
        return { ...datos, items: c.lineas.map(({ stock, ...l }) => l), subtotal: c.subtotal, envio: c.envio, cargo_empaque: c.cargo_empaque,
          total: c.total, peso_lb: c.peso_lb, creado_en: fecha, actualizado_en: fecha, historial: [{ estado: pd.estado, fecha }] };
      });
      const db = { version: D.version, productos, usuarios, pedidos, pagos: [], sesiones: {} };
      almacen.guardar('de_demo_db', db);
      return db;
    },
    async usuarioActual() {
      const s = DE.sesion.obtener(); if (!s) throw new ErrorTienda('Inicia sesión para continuar', 401);
      const db = await this.db();
      const id = db.sesiones[s.token];
      const u = db.usuarios.find((x) => x.id === id);
      if (!u) throw new ErrorTienda('Tu sesión expiró. Vuelve a iniciar sesión', 401);
      return u;
    },
    async admin() { const u = await this.usuarioActual(); if (u.rol !== 'admin') throw new ErrorTienda('Solo el administrador puede hacer esto', 403); return u; },
    publico(u) { const { password_hash, sal, ...resto } = u; return resto; },
    mapaProductos(db) { return Object.fromEntries(db.productos.map((p) => [p.id, p])); },
  };

  const apiDemo = {
    productos: {
      async listar(f) { const db = await Demo.db(); await esperar(120); return DE.filtrarProductos(db.productos, f); },
      async obtener(id) {
        const db = await Demo.db(); await esperar(80);
        const p = db.productos.find((x) => x.id === Number(id) && x.activo !== false);
        if (!p) throw new ErrorTienda('Este producto no existe o ya no está disponible', 404);
        return p;
      },
      async categorias() {
        const db = await Demo.db();
        return Object.keys(DE.CATEGORIAS).map((c) => ({ categoria: c, total: db.productos.filter((p) => p.activo !== false && p.categoria === c).length }));
      },
      async guardar(datos) {
        await Demo.admin(); const db = await Demo.db();
        if (datos.id) {
          const p = db.productos.find((x) => x.id === Number(datos.id)); if (!p) throw new ErrorTienda('Producto no encontrado', 404);
          Object.assign(p, completarProducto({ ...p, ...datos }));
          Demo.guardar(); return p;
        }
        const nuevo = completarProducto({ ...datos, id: Math.max(0, ...db.productos.map((p) => p.id)) + 1, ventas: 0, activo: true, creado_en: new Date().toISOString() });
        db.productos.push(nuevo); Demo.guardar(); return nuevo;
      },
      async eliminar(id) { await Demo.admin(); const db = await Demo.db(); const p = db.productos.find((x) => x.id === id); if (p) p.activo = false; Demo.guardar(); },
      async ajustarStock(id, stock) {
        await Demo.admin(); const db = await Demo.db(); const p = db.productos.find((x) => x.id === id);
        if (!p) throw new ErrorTienda('Producto no encontrado', 404);
        p.stock = Math.max(0, Math.round(stock)); Demo.guardar(); return p;
      },
      async alertas() { await Demo.admin(); const db = await Demo.db(); return db.productos.filter((p) => p.activo !== false && p.stock <= R.stockBajo).sort((a, b) => a.stock - b.stock); },
    },

    auth: {
      async registrar({ nombre, email, password, telefono = '', mayorista = false }) {
        const db = await Demo.db(); await esperar(150);
        email = String(email).trim().toLowerCase();
        if (db.usuarios.some((u) => u.email === email)) throw new ErrorTienda('Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?', 409);
        const sal = tokenAleatorio().slice(0, 16);
        const u = { id: Math.max(0, ...db.usuarios.map((x) => x.id)) + 1, nombre: nombre.trim(), email, telefono, rol: 'cliente',
          solicita_mayorista: !!mayorista, puntos: 0, sal, password_hash: await cifrar(sal + password), creado_en: new Date().toISOString() };
        db.usuarios.push(u); Demo.guardar();
        return Demo.publico(u);
      },
      async iniciarSesion(email, password) {
        const db = await Demo.db(); await esperar(150);
        const u = db.usuarios.find((x) => x.email === String(email).trim().toLowerCase());
        if (!u || u.password_hash !== await cifrar(u.sal + password)) throw new ErrorTienda('Correo o contraseña incorrectos', 401);
        const token = tokenAleatorio(); db.sesiones[token] = u.id; Demo.guardar();
        return { token, usuario: Demo.publico(u) };
      },
      async cerrarSesion() { const s = DE.sesion.obtener(); const db = await Demo.db(); if (s) delete db.sesiones[s.token]; Demo.guardar(); },
      async perfil() { return Demo.publico(await Demo.usuarioActual()); },
      async solicitarMayorista() { const u = await Demo.usuarioActual(); u.solicita_mayorista = true; Demo.guardar(); return Demo.publico(u); },
    },

    usuarios: {
      async listar({ q = '' } = {}) {
        await Demo.admin(); const db = await Demo.db(); const t = DE.normalizar(q);
        return db.usuarios.filter((u) => !t || DE.normalizar(u.nombre + ' ' + u.email).includes(t)).map(Demo.publico)
          .sort((a, b) => Number(b.solicita_mayorista) - Number(a.solicita_mayorista) || a.id - b.id);
      },
      async cambiarRol(id, rol) {
        await Demo.admin(); const db = await Demo.db(); const u = db.usuarios.find((x) => x.id === id);
        if (!u) throw new ErrorTienda('Cliente no encontrado', 404);
        u.rol = rol; u.solicita_mayorista = false; Demo.guardar(); return Demo.publico(u);
      },
    },

    pedidos: {
      async cotizar(datos) {
        const db = await Demo.db(); const s = DE.sesion.obtener();
        const rol = s ? db.usuarios.find((u) => u.id === db.sesiones[s.token])?.rol : null;
        return DE.cotizar(datos, Demo.mapaProductos(db), rol);
      },
      async crear(datos) {
        const u = await Demo.usuarioActual(); const db = await Demo.db(); await esperar(250);
        const c = DE.cotizar(datos, Demo.mapaProductos(db), u.rol);
        if (c.errores.length) throw new ErrorTienda(c.errores[0], 409);
        c.lineas.forEach((l) => { const p = db.productos.find((x) => x.id === l.producto_id); p.stock -= l.cantidad; p.ventas += l.cantidad; }); // RN-01
        const ahora = new Date().toISOString();
        const pedido = {
          id: Math.max(0, ...db.pedidos.map((p) => p.id)) + 1, usuario_id: u.id,
          nombre: datos.nombre, telefono: datos.telefono, entrega: datos.entrega, departamento: datos.departamento, municipio: datos.municipio,
          direccion: datos.direccion || '', mensajeria: datos.mensajeria || '', metodo_pago: datos.metodo_pago, cuotas: datos.cuotas || 1,
          banco: datos.banco || '', empaque_regalo: !!datos.empaque_regalo, mensaje_regalo: datos.mensaje_regalo || '', notas: datos.notas || '',
          items: c.lineas.map(({ stock, ...l }) => l), subtotal: c.subtotal, envio: c.envio, cargo_empaque: c.cargo_empaque, total: c.total,
          peso_lb: c.peso_lb, estado: 'PENDIENTE', creado_en: ahora, actualizado_en: ahora, historial: [{ estado: 'PENDIENTE', fecha: ahora }],
        };
        db.pedidos.push(pedido); Demo.guardar();
        return pedido;
      },
      async listar({ estado = '', pagina = 1, por_pagina = 20 } = {}) {
        const u = await Demo.usuarioActual(); const db = await Demo.db(); await esperar(100);
        let r = db.pedidos.filter((p) => (u.rol === 'admin' || p.usuario_id === u.id) && (!estado || p.estado === estado));
        r = r.slice().sort((a, b) => b.id - a.id);
        return { total: r.length, pagina, data: r.slice((pagina - 1) * por_pagina, pagina * por_pagina) };
      },
      async obtener(id) {
        const u = await Demo.usuarioActual(); const db = await Demo.db(); await esperar(80);
        const p = db.pedidos.find((x) => x.id === Number(id));
        if (!p || (u.rol !== 'admin' && p.usuario_id !== u.id)) throw new ErrorTienda('No encontramos ese pedido en tu cuenta', 404);
        return p;
      },
      async cambiarEstado(id, estado) {
        await Demo.admin(); const db = await Demo.db(); const p = db.pedidos.find((x) => x.id === id);
        if (!p) throw new ErrorTienda('Pedido no encontrado', 404);
        return cambiarEstadoDemo(db, p, estado);
      },
      async resumen() {
        await Demo.admin(); const db = await Demo.db(); const hoy = new Date().toDateString();
        const pagados = db.pedidos.filter((p) => !['PENDIENTE', 'CANCELADO'].includes(p.estado));
        return {
          total: db.pedidos.length,
          pendientes: db.pedidos.filter((p) => p.estado === 'PENDIENTE').length,
          por_preparar: db.pedidos.filter((p) => ['PAGADO', 'EN_PREPARACION'].includes(p.estado)).length,
          ventas: DE.redondear(pagados.reduce((s, p) => s + p.total, 0)),
          ventas_hoy: DE.redondear(pagados.filter((p) => new Date(p.creado_en).toDateString() === hoy).reduce((s, p) => s + p.total, 0)),
        };
      },
    },

    pagos: {
      async pagar(pedidoId) {
        const u = await Demo.usuarioActual(); const db = await Demo.db(); await esperar(600);
        const p = db.pedidos.find((x) => x.id === Number(pedidoId));
        if (!p || (u.rol !== 'admin' && p.usuario_id !== u.id)) throw new ErrorTienda('Pedido no encontrado', 404);
        if (p.estado !== 'PENDIENTE' || db.pagos.some((x) => x.pedido_id === p.id)) throw new ErrorTienda('Este pedido ya tiene un pago registrado', 409);
        const res = {
          tarjeta: { estado: 'APROBADO', pedido: 'PAGADO', mensaje: 'Pago aprobado (simulado).' },
          transferencia: { estado: 'PENDIENTE_VERIFICACION', pedido: null, mensaje: 'Realiza la transferencia y envíanos el comprobante por WhatsApp.' },
          contra_entrega: { estado: 'PENDIENTE_COBRO', pedido: 'EN_PREPARACION', mensaje: 'Pagarás al recibir o recoger tu pedido.' },
        }[p.metodo_pago];
        const pago = { id: db.pagos.length + 1, pedido_id: p.id, monto: p.total, metodo: p.metodo_pago, cuotas: p.cuotas, estado: res.estado,
          referencia: 'SIM-' + tokenAleatorio().slice(0, 8).toUpperCase(), creado_en: new Date().toISOString() };
        db.pagos.push(pago);
        if (res.pedido) cambiarEstadoDemo(db, p, res.pedido); else Demo.guardar();
        return { ...pago, mensaje: res.mensaje, estado_pedido: p.estado };
      },
    },
  };

  function cambiarEstadoDemo(db, p, estado) {
    if (!DE.ESTADOS[estado]) throw new ErrorTienda('Estado no válido');
    if (p.estado === 'CANCELADO' && estado !== 'CANCELADO') throw new ErrorTienda('Un pedido cancelado no se puede reactivar', 409);
    const anterior = p.estado;
    if (estado === 'CANCELADO' && anterior !== 'CANCELADO')                                   // devuelve existencias
      p.items.forEach((l) => { const pr = db.productos.find((x) => x.id === l.producto_id); if (pr) pr.stock += l.cantidad; });
    const pagado = ['PAGADO', 'EN_PREPARACION', 'ENVIADO', 'LISTO_PARA_RECOGER', 'ENTREGADO'];
    if (estado === 'PAGADO' && !pagado.includes(anterior)) {                                   // RF-12: suma puntos al pagar
      const u = db.usuarios.find((x) => x.id === p.usuario_id); if (u) u.puntos += Math.floor(p.subtotal / R.puntosCadaQ);
    }
    p.estado = estado; p.actualizado_en = new Date().toISOString();
    p.historial = [...(p.historial || []), { estado, fecha: p.actualizado_en }];
    Demo.guardar();
    return p;
  }

  /* ============================================================
     5. MODO API: llamadas reales al backend (ver INTEGRACION.md)
     ============================================================ */
  const NOMBRES_CAMPOS = { email: 'correo', password: 'contraseña (mínimo 8 caracteres)', nombre: 'nombre', telefono: 'teléfono',
    direccion: 'dirección', municipio: 'municipio', departamento: 'departamento', precio: 'precio', stock: 'existencias' };

  async function http(ruta, { metodo = 'GET', datos, parametros } = {}) {
    const url = new URL(CONFIG.API_URL.replace(/\/$/, '') + ruta, location.href);
    Object.entries(parametros || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)) return;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    const cabeceras = {};
    const s = DE.sesion.obtener();
    if (s) cabeceras.Authorization = 'Bearer ' + s.token;
    if (datos !== undefined && !(datos instanceof FormData)) {
		cabeceras['Content-Type'] = 'application/json';
	}
    let resp;
    try { resp = await fetch(url, { method: metodo, headers: cabeceras, body: datos instanceof FormData
	  ? datos
	  : datos !== undefined
		? JSON.stringify(datos)
		: undefined }); }
    catch { throw new ErrorTienda('No pudimos conectarnos con la tienda. Revisa tu conexión e intenta de nuevo.', 0); }
    let cuerpo = null;
    try { cuerpo = await resp.json(); } catch { /* sin cuerpo */ }
    if (!resp.ok) {
      if (resp.status === 401 && s) DE.sesion.cerrar();
      const d = cuerpo && cuerpo.detail;
      let mensaje = 'Algo salió mal. Intenta de nuevo.';
      if (typeof d === 'string') mensaje = d;
      else if (Array.isArray(d)) mensaje = 'Revisa estos datos: ' + [...new Set(d.map((e) => NOMBRES_CAMPOS[e.loc?.at(-1)] || e.loc?.at(-1)))].join(', ') + '.';
      else if (resp.status >= 500) mensaje = 'La tienda tuvo un problema. Intenta de nuevo en unos minutos.';
      throw new ErrorTienda(mensaje, resp.status);
    }
    return cuerpo;
  }
  DE.http = http;
  const noExiste = (e) => e instanceof ErrorTienda && [404, 405].includes(e.estado);

  const apiReal = {
    productos: {
      async listar(f) {
        const r = await http('/catalogo/productos', { parametros: f });
        if (r.total === undefined) return DE.filtrarProductos(r.data.map(completarProducto), f); // backend sin filtros aún
        return { ...r, data: r.data.map(completarProducto) };
      },
      async obtener(id) { return completarProducto(await http(`/catalogo/productos/${Number(id)}`)); },
      async categorias() {
        try { return await http('/catalogo/categorias'); }
        catch (e) {
          if (!noExiste(e)) throw e;
          const r = await this.listar({ por_pagina: 1000 });
          return Object.keys(DE.CATEGORIAS).map((c) => ({ categoria: c, total: r.data.filter((p) => p.categoria === c).length }));
        }
      },
      guardar(datos) {
		  const formData = new FormData();

		  formData.append('nombre', datos.nombre);
		  formData.append('categoria', datos.categoria);
		  formData.append('tipo', datos.tipo);
		  formData.append('descripcion', datos.descripcion ?? '');
		  formData.append('precio', datos.precio);
		  formData.append('stock', datos.stock);
		  formData.append('precio_mayorista', datos.precio_mayorista ?? 0);
		  formData.append('minimo_mayorista', datos.minimo_mayorista);
		  formData.append('peso_lb', datos.peso_lb);
		  formData.append('destacado', datos.destacado);

		  if (datos.id) {
			if (datos.imagen) {
			  formData.append('imagen', datos.imagen);
			}

			return http(`/catalogo/productos/${datos.id}`, {
			  metodo: 'PUT',
			  datos: formData
			});
		  }

		  formData.append('ventas', 0);

		  if (datos.imagen) {
			formData.append('imagen', datos.imagen);
		  }

		  return http('/catalogo/productos', {
			metodo: 'POST',
			datos: formData
		  });
		},
      eliminar(id) { return http(`/catalogo/productos/${id}`, { metodo: 'DELETE' }); },
      ajustarStock(id, stock) { return http(`/catalogo/productos/${id}/stock`, { metodo: 'PATCH', datos: { stock } }); },
      alertas() { return http('/catalogo/inventario/alertas'); },
    },
    auth: {
      registrar(datos) { return http('/auth/register', { metodo: 'POST', datos }); },
      async iniciarSesion(email, password) {
	  return await http('/auth/login', {
		metodo: 'POST',
		datos: { email, password }
	  });
	},
      async cerrarSesion() { try { await http('/auth/logout', { metodo: 'POST' }); } catch { /* opcional en el backend */ } },
      async perfil() {
        try { return await http('/auth/me'); }
        catch (e) { if (noExiste(e)) return DE.sesion.obtener()?.usuario; throw e; }
      },
      solicitarMayorista() { return http('/auth/me/solicitar-mayorista', { metodo: 'POST' }); },
    },
    usuarios: {
	  listar(f) {
		return http('/auth/usuarios', { parametros: f })
		  .then((r) => Array.isArray(r) ? r : r.data);
	  },
	  cambiarRol(id, rol) {
		return http(`/auth/usuarios/${id}`, {
		  metodo: 'PATCH',
		  datos: { rol }
		});
	  },
	},
    pedidos: {
      async cotizar(datos) {
        try { return await http('/pedidos/cotizar', { metodo: 'POST', datos }); }
        catch (e) {
          if (!noExiste(e)) throw e;
          // Respaldo mientras el backend no tenga /cotizar: se calcula aquí con los datos reales del catálogo.
          const ids = [...new Set(datos.items.map((i) => i.producto_id))];
          const r = await apiReal.productos.listar({ ids: ids.join(','), por_pagina: 100 });
          return DE.cotizar(datos, Object.fromEntries(r.data.map((p) => [p.id, p])), DE.sesion.obtener()?.usuario.rol);
        }
      },
      crear(datos) { return http('/pedidos', { metodo: 'POST', datos }); },
      listar(f) { return http('/pedidos', { parametros: f }).then((r) => (Array.isArray(r) ? { total: r.length, pagina: 1, data: r } : r)); },
      obtener(id) { return http(`/pedidos/${Number(id)}`); },
      cambiarEstado(id, estado) { return http(`/pedidos/${id}/estado`, { metodo: 'PATCH', datos: { estado } }); },
      resumen() { return http('/pedidos/resumen'); },
    },
    pagos: {
      pagar(pedidoId) { return http('/pagos', { metodo: 'POST', datos: { pedido_id: Number(pedidoId) } }); },
    },
  };

  DE.api = CONFIG.MODO === 'api' ? apiReal : apiDemo;

  /* ============================================================
     6. CARRITO (se guarda en el navegador)
     ============================================================ */
  DE.carrito = {
    leer() { const c = almacen.leer('de_carrito', []); return Array.isArray(c) ? c.filter((i) => Number.isInteger(i.id) && i.cantidad > 0) : []; },
    guardar(items) { almacen.guardar('de_carrito', items); document.dispatchEvent(new CustomEvent('carrito:cambio')); },
    agregar(id, cantidad = 1, maximo = Infinity) {
      const items = this.leer(); const i = items.find((x) => x.id === id);
      const actual = i ? i.cantidad : 0;
      const nueva = Math.min(actual + cantidad, maximo);
      if (i) i.cantidad = nueva; else items.push({ id, cantidad: nueva });
      this.guardar(items);
      return nueva - actual;
    },
    cambiar(id, cantidad) {
      if (cantidad <= 0) return this.quitar(id);
      const items = this.leer(); const i = items.find((x) => x.id === id); if (i) i.cantidad = cantidad; this.guardar(items);
    },
    quitar(id) { this.guardar(this.leer().filter((x) => x.id !== id)); },
    vaciar() { this.guardar([]); },
    unidades() { return this.leer().reduce((s, i) => s + i.cantidad, 0); },
    comoItems() { return this.leer().map((i) => ({ producto_id: i.id, cantidad: i.cantidad })); },
  };
  window.addEventListener('storage', (e) => { if (e.key === 'de_carrito') document.dispatchEvent(new CustomEvent('carrito:cambio')); });

  /* ============================================================
     7. COMPONENTES VISUALES
     ============================================================ */
  const ui = (DE.ui = {});
  ui.icono = (id, clase = 'ico', estilo = '') => `<svg class="${clase}"${estilo ? ` style="${estilo}"` : ''} aria-hidden="true"><use href="#${id}"/></svg>`;

  ui.foto = (p) => {
    const cat = DE.categoria(p.categoria);
    if (p.imagen_url) return `<img class="foto-img" src="${DE.esc(p.imagen_url)}" alt="${DE.esc(p.nombre)}" loading="lazy" decoding="async">`;
    return `<div class="foto-marcador" style="background:${cat.color}" role="img" aria-label="Foto pendiente: ${DE.esc(p.nombre)}">${ui.icono(cat.icono)}</div>`;
  };

  ui.avisoCorto = (p) => p.tipo === 'perecedero' ? `<p class="aviso-corto perecedero">${DE.TEXTOS.perecederoCorto}</p>`
    : p.tipo === 'liquido' ? `<p class="aviso-corto liquido">${DE.TEXTOS.liquidoCorto}</p>` : '';

  ui.tarjeta = (p) => {
    const cat = DE.categoria(p.categoria), st = DE.stockEstado(p), url = `producto.html?id=${p.id}`;
    const insignia = st.clase === 'agotado' ? '<span class="insignia insignia--oscura">Agotado</span>'
      : st.clase === 'bajo' ? `<span class="insignia">¡Últimas ${p.stock}!</span>` : '';
    const etiqueta = p.tipo === 'perecedero' ? `<span class="etiquetas"><span class="et-perecedero" title="Perecedero">${ui.icono('i-reloj')}</span></span>`
      : p.tipo === 'liquido' ? `<span class="etiquetas"><span class="et-liquido" title="Líquido o aerosol">${ui.icono('i-gota')}</span></span>` : '';
    const boton = st.clase === 'agotado'
      ? `<a class="btn btn-borde btn-carrito" ${DE.whatsappEnlace(`Hola, ¿me avisan cuando vuelva a haber «${p.nombre}»?`)}>${ui.icono('i-campana')}Avisarme</a>`
      : `<button class="btn btn-primario btn-carrito" type="button" data-agregar="${p.id}" data-stock="${p.stock}" data-nombre="${DE.esc(p.nombre)}">${ui.icono('i-carrito')}Agregar</button>`;
    return `<article class="producto">
      <a class="producto-foto" href="${url}" tabindex="-1" aria-hidden="true">${insignia}${etiqueta}${ui.foto(p)}</a>
      <div class="producto-info">
        <p class="producto-cat">${cat.corto}</p>
        <h3 class="producto-nombre"><a href="${url}">${DE.esc(p.nombre)}</a></h3>
        <p class="precio">${DE.dinero(p.precio)}</p>
        <p class="stock stock--${st.clase}">${st.texto}</p>
        ${ui.avisoCorto(p)}
        ${boton}
      </div>
    </article>`;
  };

  ui.estado = (estado) => `<span class="estado estado--${estado}">${DE.ESTADOS[estado] || estado}</span>`;
  ui.cargando = (texto = 'Cargando…') => `<div class="cargando" role="status">${texto}</div>`;
  ui.vacio = (icono, titulo, texto, accion = '') => `<div class="vacio">${ui.icono(icono)}<h2>${titulo}</h2><p>${texto}</p>${accion}</div>`;
  ui.error = (mensaje, reintentar = true) => `<div class="alerta alerta--error" role="alert">${ui.icono('i-alerta')}<div><strong class="alerta-titulo">No pudimos cargar esta información</strong>${DE.esc(mensaje)}${reintentar ? ' <button class="btn-texto" type="button" onclick="location.reload()">Intentar de nuevo</button>' : ''}</div></div>`;
  ui.alerta = (tipo, texto, titulo = '') => {
    const ic = { info: 'i-info', aviso: 'i-alerta', exito: 'i-check', error: 'i-alerta', perecedero: 'i-reloj', liquido: 'i-gota' }[tipo] || 'i-info';
    const clase = { perecedero: 'aviso', liquido: 'info' }[tipo] || tipo;
    return `<div class="alerta alerta--${clase}">${ui.icono(ic)}<div>${titulo ? `<strong class="alerta-titulo">${titulo}</strong>` : ''}${texto}</div></div>`;
  };

  let temporizadorToast;
  ui.toast = (html, ms = 3500) => {
    const t = DE.$('#toast'); if (!t) return;
    t.innerHTML = html; t.classList.add('visible');
    clearTimeout(temporizadorToast); temporizadorToast = setTimeout(() => t.classList.remove('visible'), ms);
  };

  /** Botones de paginación: 1 … 4 5 6 … 21 */
  ui.paginacion = (cont, { pagina, paginas, total, por_pagina }, alCambiar) => {
    if (!cont) return;
    if (!total) { cont.innerHTML = ''; return; }
    const desde = (pagina - 1) * por_pagina + 1, hasta = Math.min(pagina * por_pagina, total);
    const nums = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
    const lista = [...nums].sort((a, b) => a - b);
    let html = `<li><button type="button" data-pag="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior">${ui.icono('i-flecha-izq')}</button></li>`;
    lista.forEach((n, i) => {
      if (i && n - lista[i - 1] > 1) html += '<li><span class="puntos" aria-hidden="true">…</span></li>';
      html += `<li><button type="button" data-pag="${n}" ${n === pagina ? 'aria-current="page"' : ''} aria-label="Página ${n}">${n}</button></li>`;
    });
    html += `<li><button type="button" data-pag="${pagina + 1}" ${pagina >= paginas ? 'disabled' : ''} aria-label="Página siguiente">${ui.icono('i-flecha-der')}</button></li>`;
    cont.innerHTML = `<p>Mostrando ${desde}–${hasta} de ${total} productos</p><ul>${html}</ul>`;
    cont.onclick = (e) => { const b = e.target.closest('[data-pag]'); if (b && !b.disabled) alCambiar(Number(b.dataset.pag)); };
  };

  /** Selector de cantidad (− 1 +) reutilizable. */
  ui.cantidad = (id, valor, maximo, etiqueta = 'Cantidad') => `<div class="cantidad" data-cantidad="${id}">
      <button type="button" data-paso="-1" aria-label="Quitar uno" ${valor <= 1 ? 'disabled' : ''}>−</button>
      <input type="number" inputmode="numeric" min="1" max="${maximo}" value="${valor}" aria-label="${etiqueta}">
      <button type="button" data-paso="1" aria-label="Agregar uno" ${valor >= maximo ? 'disabled' : ''}>+</button>
    </div>`;
  ui.leerCantidad = (el) => { const inp = el.querySelector('input'); return Math.min(Math.max(1, parseInt(inp.value, 10) || 1), Number(inp.max) || 999); };
  ui.enlazarCantidad = (el, alCambiar) => {
    const inp = el.querySelector('input'), max = Number(inp.max) || 999;
    const fijar = (v) => {
      v = Math.min(Math.max(1, v), max); inp.value = v;
      el.querySelector('[data-paso="-1"]').disabled = v <= 1; el.querySelector('[data-paso="1"]').disabled = v >= max;
      if (alCambiar) alCambiar(v);
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-paso]'); if (b) fijar(ui.leerCantidad(el) + Number(b.dataset.paso)); });
    inp.addEventListener('change', () => fijar(parseInt(inp.value, 10) || 1));
  };

  /** Muestra errores de validación junto a cada campo. Devuelve true si todo está bien. */
  ui.validar = (form, reglas) => {
    let primero = null;
    Object.entries(reglas).forEach(([nombre, validar]) => {
      const campo = form.elements[nombre]; if (!campo) return;
      const mensaje = validar(campo.value.trim(), form) || '';
      const error = DE.$(`#error-${nombre}`, form);
      if (error) error.textContent = mensaje;
      campo.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      if (mensaje && !primero) primero = campo;
    });
    if (primero) primero.focus();
    return !primero;
  };
  DE.validaciones = {
    requerido: (m) => (v) => (v ? '' : m),
    email: (v) => (!v ? 'Escribe tu correo electrónico.' : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'Escribe un correo válido, por ejemplo ana@gmail.com.'),
    telefono: (v) => (!v ? 'Escribe un número de teléfono.' : v.replace(/\D/g, '').length >= 8 ? '' : 'El teléfono debe tener al menos 8 dígitos.'),
    password: (v) => (v.length >= 8 ? '' : 'La contraseña debe tener al menos 8 caracteres.'),
  };

  /** Atributos de un enlace a WhatsApp; mientras no haya número configurado, lleva a la sección de contacto. */
  DE.whatsappEnlace = (texto) => CONFIG.NEGOCIO.whatsapp
    ? `href="https://wa.me/${CONFIG.NEGOCIO.whatsapp}?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener"`
    : 'href="ayuda.html#contacto"';

  /* ============================================================
     8. CABECERA, PIE Y NAVEGACIÓN (iguales en todas las páginas)
     ============================================================ */
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <symbol id="i-bolsa" viewBox="0 0 24 24"><path d="M5 9h14l-1 11H6L5 9z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></symbol>
    <symbol id="i-paleta" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="13.5" cy="12" r="2"/><path d="M18 10v4"/></symbol>
    <symbol id="i-limpieza" viewBox="0 0 24 24"><path d="M8 10h7v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10z"/><path d="M9 10V7h4l4-2"/><path d="M13 7h3"/></symbol>
    <symbol id="i-dulce" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M8 12 4 9v6l4-3zM16 12l4-3v6l-4-3z"/></symbol>
    <symbol id="i-cafe" viewBox="0 0 24 24"><path d="M5 10h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-5z"/><path d="M16 11h1.5a2 2 0 0 1 0 4H16"/><path d="M9 3.5c0 1.5 1.5 1.5 1.5 3M12.5 3.5c0 1.5 1.5 1.5 1.5 3"/></symbol>
    <symbol id="i-regalo" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3.5-5.5-3-4.5 0M12 7c1.5-3.5 5.5-3 4.5 0"/></symbol>
    <symbol id="i-carrito" viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></symbol>
    <symbol id="i-usuario" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/></symbol>
    <symbol id="i-buscar" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></symbol>
    <symbol id="i-casa" viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></symbol>
    <symbol id="i-cuadricula" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></symbol>
    <symbol id="i-caja" viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></symbol>
    <symbol id="i-camion" viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></symbol>
    <symbol id="i-estrella" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></symbol>
    <symbol id="i-tienda" viewBox="0 0 24 24"><path d="M4 9 5.5 4h13L20 9M4 9h16v11H4zM4 9c0 2 3.5 2 4 0 .5 2 3.5 2 4 0 .5 2 3.5 2 4 0 .5 2 4 2 4 0"/><path d="M10 20v-5h4v5"/></symbol>
    <symbol id="i-tarjeta" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
    <symbol id="i-reloj" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20z"/><path d="M9 10c.5 2 2.5 4 5 5l1-1.5-2-1-1 .8c-.8-.4-1.4-1-1.8-1.8l.8-1-1-2L9 10z"/></symbol>
    <symbol id="i-filtro" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></symbol>
    <symbol id="i-cerrar" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="i-gota" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></symbol>
    <symbol id="i-campana" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/></symbol>
    <symbol id="i-flecha-izq" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
    <symbol id="i-flecha-der" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
    <symbol id="i-alerta" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></symbol>
    <symbol id="i-basura" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>
    <symbol id="i-lapiz" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13 7l4 4"/></symbol>
    <symbol id="i-mas" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-panel" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></symbol>
    <symbol id="i-salir" viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/></symbol>
    <symbol id="i-banco" viewBox="0 0 24 24"><path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></symbol>
    <symbol id="i-efectivo" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.5M18 14.5v.5"/></symbol>
    <symbol id="i-personas" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.8 3.4-5.5 6.5-5.5s5.7 1.7 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/></symbol>
    <symbol id="i-grafica" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
    <g id="bandera"><path d="M6 3H54V40L50 46L46 40L42 46L38 40L34 46L30 40L26 46L22 40L18 46L14 40L10 46L6 40Z"/><g fill="#FFF8F0"><path d="M30 12l6 8-6 8-6-8z"/><circle cx="16" cy="13" r="3"/><circle cx="44" cy="13" r="3"/><circle cx="16" cy="29" r="3"/><circle cx="44" cy="29" r="3"/><circle cx="30" cy="35" r="2"/></g></g>
  </svg>`;

  DE.papelPicado = () => `<svg class="papel-picado" aria-hidden="true"><defs><pattern id="pp" width="240" height="52" patternUnits="userSpaceOnUse">
    <path d="M0 3H240" stroke="#2A1E17" stroke-width="1.5"/><use href="#bandera" fill="#C2185B"/><use href="#bandera" x="60" fill="#F2B705"/>
    <use href="#bandera" x="120" fill="#0B6E4F"/><use href="#bandera" x="180" fill="#2B3A8C"/></pattern></defs><rect width="100%" height="52" fill="url(#pp)"/></svg>`;

  function cabecera(pagina, sesion) {
    const act = (...ps) => (ps.includes(pagina) ? ' aria-current="page"' : '');
    const u = sesion && sesion.usuario;
    const cuenta = u
      ? `<a class="btn-icono solo-escritorio" href="cuenta.html" aria-label="Mi cuenta (${DE.esc(u.nombre)})" title="Mi cuenta">${ui.icono('i-usuario')}</a>`
      : `<a class="btn-icono solo-escritorio" href="login.html" aria-label="Iniciar sesión" title="Iniciar sesión">${ui.icono('i-usuario')}</a>`;
    const admin = u && u.rol === 'admin' ? `<a class="btn-icono" href="admin.html" aria-label="Panel de administración" title="Panel de administración">${ui.icono('i-panel')}</a>` : '';
    return `
      <a class="saltar" href="#contenido">Saltar al contenido</a>
      ${CONFIG.MODO === 'demo' ? '<p class="barra-demo">Versión de demostración: los productos y pedidos son de ejemplo y se guardan solo en este navegador.</p>' : ''}
      <p class="barra-envio">Envío gratis en compras mayores a ${DE.dinero(R.envioGratisDesde)} (hasta ${R.envioGratisMaxLb} lb)</p>
      <header class="cabecera">
        <div class="contenedor">
          <a class="logo" href="index.html" aria-label="${CONFIG.NEGOCIO.nombre}, ir al inicio">
            <span class="logo-marca" aria-hidden="true">[LOGO]</span>
            <span class="logo-nombre">Detalles Eternos<small>Tienda mexicana · GT</small></span>
          </a>
          <nav class="nav-principal" aria-label="Principal">
            <a href="index.html"${act('inicio')}>Inicio</a>
            <a href="catalogo.html"${act('catalogo', 'producto')}>Catálogo</a>
            <a href="mayoristas.html"${act('mayoristas')}>Mayoristas</a>
            <a href="seguimiento.html"${act('pedidos', 'confirmacion')}>Mis pedidos</a>
          </nav>
          <form class="buscador" role="search" action="catalogo.html">
            <label class="sr-only" for="buscar-global">Buscar productos</label>
            <input id="buscar-global" name="q" type="search" placeholder="Buscar dulces, café, carteras…" value="${pagina === 'catalogo' ? DE.esc(DE.param('q') || '') : ''}">
            <button type="submit" aria-label="Buscar">${ui.icono('i-buscar')}</button>
          </form>
          <div class="acciones">
            ${admin}${cuenta}
            <a class="btn-icono" href="carrito.html" aria-label="Carrito" id="enlace-carrito">${ui.icono('i-carrito')}<span class="contador" id="contador-carrito"></span></a>
          </div>
        </div>
      </header>`;
  }

  function pie() {
    const N = CONFIG.NEGOCIO;
    return `
      <footer class="pie">
        <div class="contenedor">
          <div><p class="marca">${N.nombre}</p><p>Tienda de variedades mexicana en zona 18, Ciudad de Guatemala. Carteras, belleza, hogar, dulces, café y regalos.</p></div>
          <nav aria-labelledby="pie-tienda"><h2 id="pie-tienda">Tienda</h2><ul>
            <li><a href="catalogo.html">Catálogo</a></li><li><a href="catalogo.html?categoria=regalos">Canastas y regalos</a></li>
            <li><a href="mayoristas.html">Portal mayorista</a></li><li><a href="cuenta.html">Mi cuenta</a></li></ul></nav>
          <nav aria-labelledby="pie-ayuda"><h2 id="pie-ayuda">Ayuda</h2><ul>
            <li><a href="ayuda.html#envios">Envíos y entregas</a></li><li><a href="ayuda.html#pagos">Formas de pago</a></li>
            <li><a href="seguimiento.html">Seguir mi pedido</a></li><li><a href="ayuda.html#preguntas">Preguntas frecuentes</a></li></ul></nav>
          <div><h2>Contacto</h2><ul>
            <li>WhatsApp: <span class="marcador">${N.whatsappTexto}</span></li>
            <li>${N.zona}</li><li><span class="marcador">${N.direccion}</span></li><li>Horario: <span class="marcador">${N.horario}</span></li></ul></div>
          <p class="pie-final">© ${new Date().getFullYear()} ${N.nombre} · Pagos con tarjeta simulados en esta versión: nunca ingreses datos reales de tarjeta.</p>
        </div>
      </footer>`;
  }

  function barraInferior(pagina) {
    const act = (...ps) => (ps.includes(pagina) ? ' aria-current="page"' : '');
    const cuenta = DE.sesion.obtener() ? 'cuenta.html' : 'login.html';
    return `<nav class="barra-inferior" aria-label="Navegación rápida">
      <a href="index.html"${act('inicio')}>${ui.icono('i-casa')}Inicio</a>
      <a href="catalogo.html"${act('catalogo', 'producto')}>${ui.icono('i-cuadricula')}Catálogo</a>
      <a href="seguimiento.html"${act('pedidos', 'confirmacion')}>${ui.icono('i-caja')}Mis pedidos</a>
      <a href="${cuenta}"${act('cuenta', 'login', 'registro', 'admin')}>${ui.icono('i-usuario')}Mi cuenta</a>
    </nav>`;
  }

  function actualizarContador() {
    const n = DE.carrito.unidades();
    const c = DE.$('#contador-carrito'), enlace = DE.$('#enlace-carrito');
    if (c) c.textContent = n ? (n > 99 ? '99+' : n) : '';
    if (enlace) enlace.setAttribute('aria-label', n ? `Carrito, ${n} ${n === 1 ? 'producto' : 'productos'}` : 'Carrito vacío');
  }

  /* Botones "Agregar" de cualquier tarjeta de producto */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agregar]'); if (!b) return;
    const id = Number(b.dataset.agregar), stock = Number(b.dataset.stock);
    const origen = b.dataset.cantidadDe ? DE.$(b.dataset.cantidadDe) : null;
    const cantidad = origen ? ui.leerCantidad(origen) : 1;
    const agregados = DE.carrito.agregar(id, cantidad, stock);
    if (agregados > 0) ui.toast(`${ui.icono('i-check')}<span>«${DE.esc(b.dataset.nombre)}» en tu carrito</span><a href="carrito.html">Ver carrito</a>`);
    else ui.toast(`${ui.icono('i-alerta')}<span>Ya tienes todas las unidades disponibles en tu carrito</span>`);
  });

  /* ============================================================
     9. ARRANQUE DE CADA PÁGINA
     ============================================================ */
  DE.iniciar = (alCargar) => {
    const pagina = document.body.dataset.pagina || '';
    const sesion = DE.sesion.obtener();
    document.body.insertAdjacentHTML('afterbegin', SPRITE + cabecera(pagina, sesion));
    document.body.insertAdjacentHTML('beforeend', pie() +
      `<a class="whatsapp" ${DE.whatsappEnlace('Hola, tengo una consulta sobre la tienda')} aria-label="Escríbenos por WhatsApp">${ui.icono('i-chat')}<span>WhatsApp</span></a>` +
      barraInferior(pagina) + '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
    actualizarContador();
    document.addEventListener('carrito:cambio', actualizarContador);
    if (alCargar) {
      Promise.resolve().then(alCargar).catch((e) => {
        if (e && e.estado === 401) {                       // sesión vencida: volver a iniciar sesión
          DE.sesion.cerrar();
          location.href = 'login.html?volver=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
          return;
        }
        console.error(e);
        const main = DE.$('main');
        if (main) main.insertAdjacentHTML('afterbegin', `<div class="contenedor" style="padding-top:16px">${ui.error(e.message || 'Error inesperado')}</div>`);
      });
    }
  };
})();
