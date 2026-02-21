/**
 * Seed para tipos de compra por defecto y migraciones
 */
import { TipoCompraModel, ComprasModel } from './compras.model';

const TIPOS_DEFAULT = [
  'Supermercado',
  'Restaurante',
  'Transporte',
  'Servicios',
  'Entretenimiento',
  'Salud',
  'Otros',
];

export const seedTiposCompra = async (): Promise<void> => {
  for (const desc of TIPOS_DEFAULT) {
    await TipoCompraModel.findOneAndUpdate(
      { descripcion: desc },
      { descripcion: desc },
      { upsert: true, new: true },
    );
  }
};

/** Migración: compras sin estado se consideran aceptadas (legacy) */
export const migrateComprasEstado = async (): Promise<void> => {
  const result = await ComprasModel.updateMany(
    { $or: [{ estado: { $exists: false } }, { estado: null }] },
    { $set: { estado: 'aceptado' } },
  );
  if (result.modifiedCount > 0) {
    console.log(`📦 Migración: ${result.modifiedCount} compras actualizadas con estado 'aceptado'`);
  }
};
