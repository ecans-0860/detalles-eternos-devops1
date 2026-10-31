namespace ApiPagos.Models;

public class Pedido
{
    public int id { get; set; }
    public int usuario_id { get; set; }
    public decimal total { get; set; }
    public decimal subtotal {get; set; }
    public string metodo_pago { get; set; } = string.Empty;
    public int cuotas { get; set; }
    public string banco { get; set; } = string.Empty;
    public string estado { get; set; } = string.Empty;
    public List<PedidoHistorial> historial { get; set; } = new();
}
