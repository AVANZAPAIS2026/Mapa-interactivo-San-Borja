"""
convert.py
----------
Convierte el shapefile de lotes a GeoJSON optimizado para el mapa web.
Compatible con distritos divididos en sectores (ej: San Borja, 12 sectores).

Requisitos:
    pip install geopandas

Uso:
    python convert.py
"""

import geopandas as gpd
import os

# Habilita restauración automática de .shx cuando falta el archivo índice
os.environ.setdefault("SHAPE_RESTORE_SHX", "YES")

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
SHAPEFILE_PATH = "Data/SAN_BORJA_LM_geogpsperu_SuyoPomalia.shp"       # Ruta a tu shapefile
OUTPUT_PATH    = "Data/SAN_BORJA_LM_geogpsperu_SuyoPomalia.geojson"   # Archivo de salida
SIMPLIFY       = True                   # True recomendado para +1000 lotes
SIMPLIFY_TOL   = 0.00005                # Tolerancia de simplificación (grados)
                                        # Reducir si los lotes son muy pequeños
# ──────────────────────────────────────────────────────────────────────────────

def convertir():
    if not os.path.exists(SHAPEFILE_PATH):
        print(f"❌ No se encontró el shapefile en: {SHAPEFILE_PATH}")
        print("   Asegúrate de que la carpeta 'data/' contiene .shp .dbf .prj .shx")
        return

    print(f"📂 Cargando shapefile: {SHAPEFILE_PATH}")
    gdf = gpd.read_file(SHAPEFILE_PATH)

    print(f"   → {len(gdf)} lotes encontrados")
    print(f"   → CRS original: {gdf.crs}")
    print(f"   → Columnas disponibles: {list(gdf.columns)}")

    # Reproyectar a WGS84 (necesario para el navegador)
    if gdf.crs is None:
        print("⚠️  Sin CRS definido. Asumiendo EPSG:4326 (WGS84).")
        gdf = gdf.set_crs(epsg=4326)
    elif gdf.crs.to_epsg() != 4326:
        print("   → Reproyectando a WGS84 (EPSG:4326)...")
        gdf = gdf.to_crs(epsg=4326)

    # Simplificar geometría para mejor rendimiento en el navegador
    if SIMPLIFY:
        print(f"   → Simplificando geometría (tolerancia={SIMPLIFY_TOL})...")
        gdf.geometry = gdf.geometry.simplify(SIMPLIFY_TOL, preserve_topology=True)

    # Índice interno de lote
    gdf["_lote_idx"] = range(len(gdf))

    # Exportar
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    gdf.to_file(OUTPUT_PATH, driver="GeoJSON")

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ GeoJSON generado: {OUTPUT_PATH}")
    print(f"   Tamaño: {size_kb:.1f} KB")
    if size_kb > 5000:
        print("⚠️  Archivo grande (+5 MB). Considera aumentar SIMPLIFY_TOL.")

if __name__ == "__main__":
    convertir()
