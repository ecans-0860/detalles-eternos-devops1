using ApiPagos.Data;
using ApiPagos.DTOs;
using ApiPagos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using ApiPagos.Data;
using ApiPagos.DTOs;
using ApiPagos.Models;
using ApiPagos.Configuracion;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ApiPagos.Controllers;

[ApiController]
[Route("api/pagos/pagos")]
public class PagosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PedidosDbContext _pedidosContext;
    private readonly AuthDbContext _authContext;
    private readonly ReglasNegocioOptions _reglas;

    public PagosController(
        AppDbContext context,
        PedidosDbContext pedidosContext,
        AuthDbContext authContext,
        IOptions<ReglasNegocioOptions> reglas)
    {
        _context = context;
        _pedidosContext = pedidosContext;
        _authContext = authContext;
        _reglas = reglas.Value;
    }

    [HttpPost]
    public async Task<IActionResult> Crear(
        [FromBody] CrearPagoRequest request)
    {
        var pedido = await _pedidosContext.Pedidos
            .Include(p => p.historial)
            .FirstOrDefaultAsync(p => p.id == request.pedido_id);

        if (pedido == null)
        {
            return NotFound(new
            {
                mensaje = "El pedido no existe."
            });
        }

        // Evitar acreditar puntos más de una vez.
        if (pedido.estado == "PAGADO")
        {
            return Conflict(new
            {
                mensaje = "El pedido ya se encuentra pagado."
            });
        }

        var pago = new Pago
        {
            pedido_id = pedido.id,
            usuario_id = pedido.usuario_id,
            monto = pedido.total,
            metodo_pago = pedido.metodo_pago,
            cuotas = pedido.cuotas,
            banco = pedido.banco,
            estado = "APROBADO",
            referencia = $"SIM-{Guid.NewGuid():N}",
            creado_en = DateTime.UtcNow,
            actualizado_en = DateTime.UtcNow
        };

        _context.Pagos.Add(pago);

        // Cambiar estado del pedido.
        pedido.estado = "PAGADO";

        pedido.historial.Add(new PedidoHistorial
        {
            pedido_id = pedido.id,
            estado = "PAGADO",
            fecha = DateTime.UtcNow
        });

        // Buscar al usuario en ApiAuth.
        var usuario = await _authContext.Usuarios
            .FirstOrDefaultAsync(u => u.id == pedido.usuario_id);

        if (usuario == null)
        {
            return NotFound(new
            {
                mensaje = "No se encontró el usuario para acreditar los puntos."
            });
        }

        // Calcular puntos según la configuración.
        if (_reglas.PuntosCadaQ <= 0)
        {
            return StatusCode(500, new
            {
                mensaje = "La configuración de puntos no es válida."
            });
        }

        int puntosGanados = (int)Math.Floor(
            pedido.subtotal / _reglas.PuntosCadaQ
        );

        usuario.puntos += puntosGanados;

        // Guardar los cambios.
        await _pedidosContext.SaveChangesAsync();
        await _context.SaveChangesAsync();
        await _authContext.SaveChangesAsync();

        return Ok(new
        {
            mensaje = "Pago aprobado y puntos acreditados correctamente.",
            pago,
            puntos_ganados = puntosGanados,
            puntos_acumulados = usuario.puntos
        });
    }
}
