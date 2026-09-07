export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "platform_owner" | "admin" | "recepcionista";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  /** Hash bcrypt, nunca el PIN en sí — null = todavía no lo configuró el admin. */
  pin_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type SedeRow = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  organization_id: string | null;
  sede_id: string | null;
  role: Role;
  full_name: string;
  active: boolean;
  created_at: string;
};

export type TipoDocumento = "CC" | "TI" | "CE" | "PPT" | "PASAPORTE" | "NIT";
export type Sexo = "M" | "F" | "OTRO";

export type ClienteRow = {
  id: string;
  organization_id: string;
  sede_id: string;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombre_completo: string;
  sexo: Sexo | null;
  fecha_nacimiento: string | null;
  telefono_pais: string;
  telefono: string | null;
  correo_electronico: string | null;
  fingerprints_enrolled: number;
  /** Inscrito en el RUNT (Registro Único Nacional de Tránsito). */
  runt: boolean;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Categoria = "multiple" | "individual";
export type MetodoPago =
  | "efectivo"
  | "transferencia"
  | "tarjeta"
  | "nequi"
  | "addi"
  | "credito"
  | "otro";

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  nequi: "Nequi",
  addi: "Addi",
  credito: "Crédito",
  otro: "Otro",
};
export type EstadoVenta = "pagada" | "abonada" | "anulada";
export type DescuentoTipo = "porcentaje" | "fijo";

export type ProductoRow = {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: Categoria | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VentaRow = {
  id: string;
  organization_id: string;
  sede_id: string;
  cliente_id: string;
  concepto: string;
  monto: number;
  estado: EstadoVenta;
  vendedor_id: string;
  /** Persona externa (no es un usuario del sistema) que refirió al cliente. */
  referido_nombre: string | null;
  /** Descuento en pesos sobre `monto` (bruto). Lo que hay que cobrar es `monto - descuento`. */
  descuento: number;
  /** Certificado RUNT subido — solo true si ya está paga por completo. */
  certificado: boolean;
  certificado_at: string | null;
  certificado_by: string | null;
  /** Ruta del archivo en el bucket privado `certificados-runt`. */
  certificado_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type VentaItemRow = {
  id: string;
  venta_id: string;
  organization_id: string;
  sede_id: string;
  producto_id: string | null;
  nombre: string;
  precio: number;
  created_at: string;
};

/** Item que se manda a registrar_venta (uno por producto elegido). */
export type VentaItemInput = {
  producto_id: string | null;
  nombre: string;
  precio: number;
};

export type VentaPagoRow = {
  id: string;
  venta_id: string;
  organization_id: string;
  sede_id: string;
  monto: number;
  metodo_pago: MetodoPago;
  metodo_pago_editado_por: string | null;
  metodo_pago_editado_at: string | null;
  created_by: string;
  created_at: string;
};

/** Línea de pago que se manda a registrar_venta / registrar_abono. */
export type VentaPagoInput = {
  monto: number;
  metodo_pago: MetodoPago;
};

export type EstadoCotizacion = "pendiente" | "convertida" | "rechazada";

export type CotizacionRow = {
  id: string;
  organization_id: string;
  sede_id: string;
  cliente_id: string;
  concepto: string;
  monto: number;
  estado: EstadoCotizacion;
  referido_nombre: string | null;
  valida_hasta: string | null;
  vendedor_id: string;
  venta_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CotizacionItemRow = {
  id: string;
  cotizacion_id: string;
  organization_id: string;
  sede_id: string;
  producto_id: string | null;
  nombre: string;
  precio: number;
  created_at: string;
};

export type EstadoCaja = "abierta" | "cerrada";

export type CajaSesionRow = {
  id: string;
  organization_id: string;
  sede_id: string;
  opened_by: string;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  estado: EstadoCaja;
  created_at: string;
  updated_at: string;
};

export type TipoMovimiento = "ingreso" | "egreso";

export type CajaMovimientoRow = {
  id: string;
  caja_sesion_id: string;
  organization_id: string;
  sede_id: string;
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
  metodo_pago: MetodoPago | null;
  venta_id: string | null;
  venta_pago_id: string | null;
  created_by: string;
  created_at: string;
};

type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type FunctionDef<Args, Returns> = {
  Args: Args;
  Returns: Returns;
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<OrganizationRow>;
      sedes: TableDef<SedeRow>;
      profiles: TableDef<ProfileRow>;
      clientes: TableDef<ClienteRow>;
      productos: TableDef<ProductoRow>;
      ventas: TableDef<VentaRow>;
      venta_items: TableDef<VentaItemRow>;
      venta_pagos: TableDef<VentaPagoRow>;
      cotizaciones: TableDef<CotizacionRow>;
      cotizacion_items: TableDef<CotizacionItemRow>;
      caja_sesiones: TableDef<CajaSesionRow>;
      caja_movimientos: TableDef<CajaMovimientoRow>;
    };
    Views: Record<string, never>;
    Functions: {
      registrar_venta: FunctionDef<
        {
          p_sede_id: string;
          p_cliente_id: string;
          p_items: VentaItemInput[];
          p_pagos: VentaPagoInput[];
          p_vendedor_id: string;
          p_pin?: string | null;
          p_referido_nombre?: string | null;
          p_descuento_tipo?: DescuentoTipo | null;
          p_descuento_valor?: number;
        },
        VentaRow
      >;
      registrar_abono: FunctionDef<
        {
          p_venta_id: string;
          p_pagos: VentaPagoInput[];
        },
        VentaRow
      >;
      corregir_forma_pago_venta: FunctionDef<
        { p_venta_pago_id: string; p_metodo_pago: MetodoPago },
        VentaPagoRow
      >;
      aplicar_descuento_venta: FunctionDef<
        {
          p_venta_id: string;
          p_descuento_tipo: DescuentoTipo | null;
          p_descuento_valor?: number;
        },
        VentaRow
      >;
      registrar_certificado_runt: FunctionDef<
        { p_venta_id: string; p_certificado_path: string },
        VentaRow
      >;
      set_org_pin: FunctionDef<{ p_pin: string }, null>;
      verify_org_pin: FunctionDef<{ p_pin: string }, boolean>;
      check_login_lockout: FunctionDef<
        { p_email: string },
        { locked: boolean; retry_after_seconds?: number }
      >;
      record_login_attempt: FunctionDef<
        { p_email: string; p_success: boolean },
        null
      >;
      crear_cotizacion: FunctionDef<
        {
          p_sede_id: string;
          p_cliente_id: string;
          p_items: VentaItemInput[];
          p_vendedor_id: string;
          p_referido_nombre?: string | null;
          p_valida_hasta?: string | null;
        },
        CotizacionRow
      >;
      convertir_cotizacion: FunctionDef<
        {
          p_cotizacion_id: string;
          p_pagos: VentaPagoInput[];
          p_pin?: string | null;
        },
        VentaRow
      >;
    };
  };
};
