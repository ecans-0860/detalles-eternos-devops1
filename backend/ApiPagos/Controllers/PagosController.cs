using ApiPagos.Data;
using ApiPagos.DTOs;
using ApiPagos.Models;
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
    private readonly AuthDbContext _auth;

    public PagosController(
        AppDbContext context,
        PedidosDbContext pedidosContext,
        AuthDbContext auth
        )
    {
        _context = context;
        _pedidosContext = pedidosContext;
        _auth = auth;
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

       var usuario = await _auth.Usuarios
        .FirstOrDefaultAsync(u => u.id == pedido.usuario_id);

        if (usuario == null)
        {
            return NotFound(new
            {
                mensaje = "No se encontró el usuario."
            });
        }
        
        int puntosGanados = (int)Math.Floor(
            pedido.subtotal / 10
        );
        
        usuario.puntos += puntosGanados;

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
