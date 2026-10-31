using ApiPagos.Data;
using ApiPagos.DTOs;
using ApiPagos.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiPagos.Controllers;

[ApiController]
[Route("pagos/pagos")]
public class PagosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PedidosDbContext _pedidosContext;

    public PagosController(
        AppDbContext context,
        PedidosDbContext pedidosContext)
    {
        _context = context;
        _pedidosContext = pedidosContext;
    }

    [HttpPost]
    public async Task<IActionResult> Crear(CrearPagoRequest request)
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

        pedido.estado = "PAGADO";


        pedido.historial.Add(new PedidoHistorial
        {
            pedido_id = pedido.id,
            estado = "PAGADO",
            fecha = DateTime.UtcNow
        });

        await _pedidosContext.SaveChangesAsync();
        await _context.SaveChangesAsync();

        return Ok(pago);
    }
}
