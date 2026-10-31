using ApiPedidos.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ApiPedidos.Dtos;
using ApiPedidos.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using ApiPedidos.Models;
using ApiPedidos.Configuracion;
using Microsoft.Extensions.Options;

namespace ApiPedidos.Controllers;

[ApiController]
[Route("api/pedidos/pedidos")]
public class PedidosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly CatalogoDbContext _catalogo;
    private readonly CotizacionService _cotizacionService;
    private readonly AuthDbContext _auth;
    private readonly ReglasNegocioOptions _reglas;

    public PedidosController(
    AppDbContext context,
    CatalogoDbContext catalogo,
    AuthDbContext auth,
    CotizacionService cotizacionService)
    {
        _context = context;
        _catalogo = catalogo;
        _auth = auth;
        _cotizacionService = cotizacionService;
        _reglas = reglas.Value;
    }

    [HttpGet]
    [HttpGet]
    [Authorize(Roles = "cliente,mayorista,admin")]
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var usuarioIdTexto =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!int.TryParse(usuarioIdTexto, out var usuarioId))
        {
            return Unauthorized(new
            {
                detail = "No se pudo identificar al usuario."
            });
        }

        var rol = User.FindFirstValue(ClaimTypes.Role);

        var query = _context.Pedidos
            .Include(p => p.items)
            .Include(p => p.historial)
            .AsQueryable();

        // Los clientes y mayoristas solo ven sus propios pedidos.
        if (rol != "admin")
        {
            query = query.Where(p => p.usuario_id == usuarioId);
        }

        var pedidos = await query
            .OrderByDescending(p => p.creado_en)
            .ToListAsync();

        return Ok(new
        {
            total = pedidos.Count,
            pagina = 1,
            data = pedidos.Select(p => new
            {
                p.id,
                p.usuario_id,
                p.nombre,
                p.telefono,
                p.entrega,
                p.departamento,
                p.municipio,
                p.direccion,
                p.mensajeria,
                p.metodo_pago,
                p.cuotas,
                p.banco,
                p.empaque_regalo,
                p.mensaje_regalo,
                p.notas,
                p.subtotal,
                p.envio,
                p.cargo_empaque,
                p.total,
                p.peso_lb,
                p.estado,
                p.creado_en,
                p.actualizado_en,

                items = p.items.Select(i => new
                {
                    i.id,
                    i.producto_id,
                    i.nombre,
                    i.cantidad,
                    i.precio_unitario,
                    i.subtotal
                }),

                historial = p.historial.Select(h => new
                {
                    h.id,
                    h.estado,
                    h.fecha
                })
            })
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Obtener(int id)
    {
        var pedido = await _context.Pedidos
            .Include(p => p.items)
            .Include(p => p.historial)
            .FirstOrDefaultAsync(p => p.id == id);

        if (pedido == null)
        {
            return NotFound(new
            {
                detail = "Pedido no encontrado"
            });
        }

        return Ok(new
        {
            pedido.id,
            pedido.usuario_id,
            pedido.nombre,
            pedido.telefono,
            pedido.entrega,
            pedido.departamento,
            pedido.municipio,
            pedido.direccion,
            pedido.mensajeria,
            pedido.metodo_pago,
            pedido.cuotas,
            pedido.banco,
            pedido.empaque_regalo,
            pedido.mensaje_regalo,
            pedido.notas,
            pedido.subtotal,
            pedido.envio,
            pedido.cargo_empaque,
            pedido.total,
            pedido.peso_lb,
            pedido.estado,
            pedido.creado_en,
            pedido.actualizado_en,

            items = pedido.items.Select(i => new
            {
                i.id,
                i.producto_id,
                i.nombre,
                i.cantidad,
                i.precio_unitario,
                i.subtotal
            }),

            historial = pedido.historial.Select(h => new
            {
                h.id,
                h.estado,
                h.fecha
            })
        });
    }

    [Authorize(Roles = "admin")]
    [HttpPatch("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(
    int id,
    [FromBody] CambiarEstadoRequest request)
    {
        var pedido = await _context.Pedidos
    .Include(p => p.items)
    .Include(p => p.historial)
    .FirstOrDefaultAsync(p => p.id == id);

        if (pedido == null)
        {
            return NotFound(new
            {
                detail = "Pedido no encontrado."
            });
        }

        var nuevoEstado = request.estado?.Trim().ToUpper();

        var estadosPermitidos = new[]
        {
            "PENDIENTE",
            "PAGADO",
            "EN_PREPARACION",
            "ENVIADO",
            "LISTO_PARA_RECOGER",
            "ENTREGADO",
            "CANCELADO"
        };

        if (!estadosPermitidos.Contains(nuevoEstado))
        {
            return BadRequest(new
            {
                detail = "Estado no válido.",
                estados_permitidos = estadosPermitidos
            });
        }

        if (pedido.estado == "CANCELADO")
        {
            return Conflict(new
            {
                detail = "Un pedido cancelado no puede reactivarse."
            });
        }

        var estadoAnterior = pedido.estado;

        if (pedido.estado == nuevoEstado)
        {
            return BadRequest(new
            {
                detail = $"El pedido ya se encuentra en estado {nuevoEstado}."
            });
        }

        var transicionValida = (estadoAnterior, nuevoEstado) switch
        {
            ("PENDIENTE", "PAGADO") => true,
            ("PENDIENTE", "CANCELADO") => true,

            ("PAGADO", "EN_PREPARACION") => true,
            ("PAGADO", "CANCELADO") => true,

            ("EN_PREPARACION", "ENVIADO") => pedido.entrega == "domicilio",
            ("EN_PREPARACION", "LISTO_PARA_RECOGER") => pedido.entrega == "tienda",

            ("ENVIADO", "ENTREGADO") => true,
            ("LISTO_PARA_RECOGER", "ENTREGADO") => true,

            _ => false
        };

        if (!transicionValida)
        {
            return BadRequest(new
            {
                detail = $"No se permite cambiar el pedido de {estadoAnterior} a {nuevoEstado}."
            });
        }

        if (nuevoEstado == "PAGADO" && estadoAnterior != "PAGADO")
        {
            var usuario = await _auth.Usuarios
                .FirstOrDefaultAsync(u => u.id == pedido.usuario_id);
        
            if (usuario != null)
            {
                var puntosGanados = (int)Math.Floor(
                    pedido.subtotal / _reglas.PuntosCadaQ
                );

                Console.WriteLine($"Usuario encontrado: {usuario?.id}");
                Console.WriteLine($"Puntos actuales: {usuario?.puntos}");
                Console.WriteLine($"Subtotal: {pedido.subtotal}");
                Console.WriteLine($"PuntosCadaQ: {_reglas.PuntosCadaQ}");
        
                if (puntosGanados > 0)
                {
                    usuario.puntos += puntosGanados;
                }
            }
        }

        if (nuevoEstado == "CANCELADO")
        {
            // Devolver inventario.
            foreach (var item in pedido.items)
            {
                var producto = await _catalogo.Productos
                    .FirstOrDefaultAsync(p => p.id == item.producto_id);

                if (producto != null)
                {
                    producto.stock += item.cantidad;
                    producto.ventas -= item.cantidad;

                    if (producto.ventas < 0)
                    {
                        producto.ventas = 0;
                    }
                }
            }

            // Si el pedido ya había sido pagado,
            // retirar los puntos que había generado.
            if (estadoAnterior == "PAGADO")
            {
                var usuario = await _auth.Usuarios
                    .FirstOrDefaultAsync(u => u.id == pedido.usuario_id);
            
                if (usuario != null)
                {
                    var puntosGanados = (int)Math.Floor(
                        pedido.subtotal / _reglas.PuntosCadaQ
                    );
            
                    usuario.puntos -= puntosGanados;
            
                    if (usuario.puntos < 0)
                    {
                        usuario.puntos = 0;
                    }
                }
            }
        }
        pedido.estado = nuevoEstado;
        pedido.actualizado_en = DateTime.UtcNow;

        pedido.historial.Add(new PedidoHistorial
        {
            estado = nuevoEstado,
            fecha = pedido.actualizado_en
        });

        await _context.SaveChangesAsync();
        await _auth.SaveChangesAsync();
        await _catalogo.SaveChangesAsync();

        return Ok(new
        {
            pedido.id,
            pedido.estado,
            pedido.actualizado_en,
            historial = pedido.historial.Select(h => new
            {
                h.id,
                h.estado,
                h.fecha
            })
        });
    }

    [Authorize(Roles = "admin")]
    [HttpGet("resumen")]
    public async Task<IActionResult> Resumen()
    {
        var pedidos = await _context.Pedidos
            .AsNoTracking()
            .ToListAsync();

        var estadosVenta = new[]
        {
            "PAGADO",
            "EN_PREPARACION",
            "ENVIADO",
            "LISTO_PARA_RECOGER",
            "ENTREGADO"
        };

        var inicioHoy = DateTime.UtcNow.Date;
        var finHoy = inicioHoy.AddDays(1);

        var ventas = pedidos
            .Where(p => estadosVenta.Contains(p.estado))
            .Sum(p => p.total);

        var ventasHoy = pedidos
            .Where(p =>
                estadosVenta.Contains(p.estado) &&
                p.creado_en >= inicioHoy &&
                p.creado_en < finHoy)
            .Sum(p => p.total);

        return Ok(new
        {
            total = pedidos.Count,

            pendientes = pedidos.Count(p =>
                p.estado == "PENDIENTE"),

            por_preparar = pedidos.Count(p => p.estado == "EN_PREPARACION"),
            listos_para_recoger = pedidos.Count(p => p.estado == "LISTO_PARA_RECOGER"),

            enviados = pedidos.Count(p =>
                p.estado == "ENVIADO"),

            entregados = pedidos.Count(p =>
                p.estado == "ENTREGADO"),

            cancelados = pedidos.Count(p =>
                p.estado == "CANCELADO"),

            ventas,
            ventas_hoy = ventasHoy
        });
    }

    [Authorize(Roles = "cliente,mayorista")]
    [HttpPost("cotizar")]
    public async Task<IActionResult> Cotizar(
    [FromBody] CotizarPedidoRequest request)
    {
        var rol = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        var resultado = await _cotizacionService.Cotizar(
            request,
            rol
        );

        return Ok(resultado);
    }

    [Authorize(Roles = "cliente,mayorista")]
    [HttpPost]
    public async Task<IActionResult> Crear(
    [FromBody] CrearPedidoRequest request)
    {
        var usuarioIdTexto =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        if (!int.TryParse(usuarioIdTexto, out var usuarioId))
        {
            return Unauthorized(new
            {
                detail = "No se pudo identificar al usuario."
            });
        }

        var rol = User.FindFirstValue(ClaimTypes.Role);

        // 1. Cotizar el pedido
        var cotizacionRequest = new CotizarPedidoRequest
        {
            items = request.items
                .Select(i => new CotizarItemRequest
                {
                    producto_id = i.producto_id,
                    cantidad = i.cantidad
                })
                .ToList(),

            entrega = request.entrega,
            departamento = request.departamento,
            municipio = request.municipio,
            empaque_regalo = request.empaque_regalo
        };

        var cotizacion = await _cotizacionService.Cotizar(
            cotizacionRequest,
            rol
        );

        // 2. Validar errores de la cotización
        if (cotizacion.errores.Count > 0)
        {
            return Conflict(new
            {
                detail = cotizacion.errores[0],
                errores = cotizacion.errores
            });
        }

        foreach (var linea in cotizacion.lineas)
        {
            var producto = await _catalogo.Productos
                .FirstOrDefaultAsync(p => p.id == linea.producto_id);

            if (producto == null)
            {
                return NotFound(new
                {
                    detail = $"El producto {linea.producto_id} no existe."
                });
            }

            if (producto.stock < linea.cantidad)
            {
                return Conflict(new
                {
                    detail = $"Solo quedan {producto.stock} unidades de «{producto.nombre}»."
                });
            }

            producto.stock -= linea.cantidad;
            producto.ventas += linea.cantidad;
        }

        await _catalogo.SaveChangesAsync();

        var ahora = DateTime.UtcNow;

        // 3. Crear el pedido
        var pedido = new Pedido
        {
            usuario_id = usuarioId,

            nombre = request.nombre,
            telefono = request.telefono,

            entrega = request.entrega,
            departamento = request.departamento,
            municipio = request.municipio,
            direccion = request.direccion,
            mensajeria = request.mensajeria,

            metodo_pago = request.metodo_pago,
            cuotas = request.cuotas,
            banco = request.banco,

            empaque_regalo = request.empaque_regalo,
            mensaje_regalo = request.mensaje_regalo,
            notas = request.notas,

            subtotal = cotizacion.subtotal,
            envio = cotizacion.envio,
            cargo_empaque = cotizacion.cargo_empaque,
            total = cotizacion.total,
            peso_lb = cotizacion.peso_lb,

            estado = "PENDIENTE",
            creado_en = ahora,
            actualizado_en = ahora
        };

        // 4. Agregar los productos al pedido
        foreach (var linea in cotizacion.lineas)
        {
            pedido.items.Add(new PedidoItem
            {
                producto_id = linea.producto_id,
                nombre = linea.nombre,
                cantidad = linea.cantidad,
                precio_unitario = linea.precio_unitario,
                subtotal = linea.subtotal
            });
        }

        // 5. Crear historial inicial
        pedido.historial.Add(new PedidoHistorial
        {
            estado = "PENDIENTE",
            fecha = ahora
        });

        // 6. Guardar todo
        _context.Pedidos.Add(pedido);

        await _context.SaveChangesAsync();

        // 7. Devolver el pedido creado
        return Ok(new
        {
            pedido.id,
            pedido.usuario_id,
            pedido.nombre,
            pedido.telefono,
            pedido.entrega,
            pedido.departamento,
            pedido.municipio,
            pedido.direccion,
            pedido.mensajeria,
            pedido.metodo_pago,
            pedido.cuotas,
            pedido.banco,
            pedido.empaque_regalo,
            pedido.mensaje_regalo,
            pedido.notas,
            pedido.subtotal,
            pedido.envio,
            pedido.cargo_empaque,
            pedido.total,
            pedido.peso_lb,
            pedido.estado,
            pedido.creado_en,
            pedido.actualizado_en,

            items = pedido.items.Select(i => new
            {
                i.id,
                i.producto_id,
                i.nombre,
                i.cantidad,
                i.precio_unitario,
                i.subtotal
            }),

            historial = pedido.historial.Select(h => new
            {
                h.id,
                h.estado,
                h.fecha
            })
        });
    }
}
