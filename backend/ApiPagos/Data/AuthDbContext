using ApiPagos.Models;
using Microsoft.EntityFrameworkCore;

namespace ApiPagos.Data;

public class AuthDbContext : DbContext
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options)
        : base(options)
    {
    }

    public DbSet<UsuarioAuth> Usuarios { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UsuarioAuth>()
            .ToTable("usuarios");

        modelBuilder.Entity<UsuarioAuth>()
            .HasKey(u => u.id);

        modelBuilder.Entity<UsuarioAuth>()
            .Property(u => u.puntos)
            .HasDefaultValue(0);
    }
}
