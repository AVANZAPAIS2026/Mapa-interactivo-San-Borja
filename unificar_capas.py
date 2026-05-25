"""
Unifica múltiples shapefiles en un solo archivo GeoJSON.
Uso: python unificar_capas.py

Requisitos: pip install geopandas
"""

try:
    import geopandas as gpd
    import pandas as pd
except ImportError:
    print("❌ Error: Geopandas o Pandas no están instalados.")
    print("   Ejecuta: pip install geopandas pandas pyogrio")
    import sys
    sys.exit(1)

import os
from pathlib import Path
import sys

# Habilita restauración automática de .shx cuando falta el archivo índice
os.environ.setdefault("SHAPE_RESTORE_SHX", "YES")

# ─────────────────────────────────────────────
# CONFIGURACIÓN — edita estas rutas
# ─────────────────────────────────────────────

# Carpeta que contiene todos los .shp (busca también en subcarpetas)
CARPETA_SHAPEFILES = "/Users/fabianvn/Desktop/Mapas Sebas/Capas/SUB-SECTORES"

# Nombre del archivo de salida
SALIDA_GEOJSON = "/Users/fabianvn/Desktop/Mapas Sebas/MAPA INTERACTIVO/data/mapa_unificado.geojson"

# Si True, busca shapefiles dentro de subcarpetas también
BUSCAR_RECURSIVO = True

# Configuración de optimización para mapa web
SIMPLIFY = True
SIMPLIFY_TOL = 0.00005  # Aprox. 5 metros. Aumentar si el mapa va lento.

# ─────────────────────────────────────────────


def encontrar_shapefiles(carpeta: str, recursivo: bool) -> list[Path]:
    base = Path(carpeta)
    if not base.exists():
        print(f"❌ La carpeta '{carpeta}' no existe.")
        sys.exit(1)
    patron = "**/*.shp" if recursivo else "*.shp"
    archivos = sorted(base.glob(patron))
    return archivos


def unificar_capas(archivos: list[Path], salida: str):
    capas = []
    errores = []

    print(f"\n📂 Procesando {len(archivos)} shapefiles...\n")

    for i, ruta in enumerate(archivos, 1):
        try:
            gdf = gpd.read_file(ruta)

            # Reproyectar a WGS84 (EPSG:4326) si es necesario
            if gdf.crs is None:
                print(f"  ⚠️  [{i:02d}] {ruta.stem} — sin CRS definido, se asume WGS84")
                gdf = gdf.set_crs("EPSG:4326")
            elif gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs("EPSG:4326")

            # Simplificar geometría para mejor rendimiento en el navegador
            if SIMPLIFY:
                gdf.geometry = gdf.geometry.simplify(SIMPLIFY_TOL, preserve_topology=True)

            # Agregar columna con nombre de la capa origen
            gdf["capa_origen"] = ruta.stem

            capas.append(gdf)
            print(f"  ✅ [{i:02d}] {ruta.stem} — {len(gdf)} geometrías")

        except Exception as e:
            errores.append(ruta.stem)
            print(f"  ❌ [{i:02d}] {ruta.stem} — ERROR: {e}")

    if not capas:
        print("\n❌ No se pudo leer ningún shapefile.")
        sys.exit(1)

    print(f"\n🔗 Unificando {len(capas)} capas...")
    unificado = pd.concat(capas, ignore_index=True)
    unificado = gpd.GeoDataFrame(unificado, geometry="geometry", crs="EPSG:4326")

    # Eliminar geometrías nulas
    nulas = unificado.geometry.isna().sum()
    if nulas > 0:
        print(f"  ⚠️  Eliminando {nulas} geometrías nulas")
        unificado = unificado[unificado.geometry.notna()]

    # Asegurar que el directorio de salida existe
    Path(salida).parent.mkdir(parents=True, exist_ok=True)

    print(f"💾 Guardando como '{salida}' (esto puede tardar unos segundos)...")
    # Intentar usar pyogrio para mayor velocidad si está disponible
    try:
        unificado.to_file(salida, driver="GeoJSON", engine="pyogrio")
    except Exception:
        unificado.to_file(salida, driver="GeoJSON")

    if not os.path.exists(salida):
        print(f"❌ Error crítico: El archivo no se encontró después de intentar guardarlo.")
        sys.exit(1)

    size_mb = os.path.getsize(salida) / (1024 * 1024)

    # Resumen final
    print("\n" + "─" * 50)
    print("✅ PROCESO COMPLETADO")
    print(f"   Capas procesadas : {len(capas)}")
    if errores:
        print(f"   Capas con error  : {len(errores)} → {', '.join(errores)}")
    print(f"   Total geometrías : {len(unificado):,}")
    print(f"   Tamaño archivo   : {size_mb:.2f} MB")
    print(f"   Tipos de geometría: {unificado.geometry.geom_type.value_counts().to_dict()}")
    print(f"   Archivo de salida : {Path(salida).resolve()}")
    if size_mb > 15:
        print("⚠️  Archivo pesado. Si el mapa carga lento, aumenta SIMPLIFY_TOL.")
    print("─" * 50)


if __name__ == "__main__":
    archivos = encontrar_shapefiles(CARPETA_SHAPEFILES, BUSCAR_RECURSIVO)

    if not archivos:
        print(f"⚠️  No se encontraron archivos .shp en '{CARPETA_SHAPEFILES}'")
        sys.exit(1)

    print(f"🗺️  Shapefiles encontrados: {len(archivos)}")
    for f in archivos:
        print(f"   • {f}")

    unificar_capas(archivos, SALIDA_GEOJSON)
