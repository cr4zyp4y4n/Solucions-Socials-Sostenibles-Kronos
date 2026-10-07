# Instrucciones Completas: Sistema de Fichaje para Aplicación Web React

## Índice

1. [Arquitectura General](#arquitectura-general)
2. [Base de Datos](#base-de-datos)
3. [Servicios Backend](#servicios-backend)
4. [Componentes UI](#componentes-ui)
5. [Utilidades](#utilidades)
6. [Flujos de Trabajo](#flujos-de-trabajo)

---

## Arquitectura General

El sistema de fichaje está compuesto por **3 capas principales**:

### 1. **Capa de Base de Datos** (Supabase/PostgreSQL)

- Tablas: `fichajes`, `fichajes_pausas`, `fichajes_auditoria`, `fichajes_codigos`
- Triggers automáticos para calcular horas y registrar auditoría
- Funciones RPC para operaciones del servidor
- Row Level Security (RLS) para control de acceso

### 2. **Capa de Servicios** (JavaScript)

- `fichajeSupabaseService.js`: Operaciones CRUD directas a Supabase
- `fichajeService.js`: Lógica de negocio y validaciones
- `fichajeCodigosService.js`: Gestión de códigos de fichaje

### 3. **Capa de UI** (React Components)

- `FichajePage.jsx`: Componente principal
- Modals auxiliares para formularios
- Integración con sistema de autenticación

---

## Base de Datos

### Tablas Principales

#### 1. Tabla `fichajes`

```sql
CREATE TABLE fichajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    hora_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
    hora_salida TIMESTAMPTZ,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0,
    horas_totales DECIMAL(5,2) DEFAULT 0,

    -- Control de modificaciones
    es_modificado BOOLEAN DEFAULT false,
    modificado_por UUID REFERENCES user_profiles(id),
    fecha_modificacion TIMESTAMPTZ,
    valor_original JSONB,
    notificado_trabajador BOOLEAN DEFAULT false,
    validado_por_trabajador BOOLEAN DEFAULT false,

    -- Metadatos
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES user_profiles(id),

    CONSTRAINT fichaje_unico_dia UNIQUE(empleado_id, fecha)
);
```

**Índices necesarios:**

```sql
CREATE INDEX idx_fichajes_empleado_id ON fichajes(empleado_id);
CREATE INDEX idx_fichajes_fecha ON fichajes(fecha DESC);
CREATE INDEX idx_fichajes_empleado_fecha ON fichajes(empleado_id, fecha DESC);
```

#### 2. Tabla `fichajes_pausas`

```sql
CREATE TABLE fichajes_pausas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fichaje_id UUID NOT NULL REFERENCES fichajes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'descanso', 'cafe', 'otro')),
    inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin TIMESTAMPTZ,
    duracion_minutos INTEGER,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. Tabla `fichajes_codigos`

```sql
CREATE TABLE fichajes_codigos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT NOT NULL UNIQUE,
    empleado_id TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    descripcion TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 4. Tabla `fichajes_auditoria`

```sql
CREATE TABLE fichajes_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fichaje_id UUID NOT NULL REFERENCES fichajes(id),
    accion TEXT NOT NULL CHECK (accion IN ('creado', 'modificado', 'eliminado', 'pausa_iniciada', 'pausa_finalizada', 'salida_registrada')),
    quien UUID REFERENCES user_profiles(id),
    cuando TIMESTAMPTZ NOT NULL DEFAULT now(),
    valor_anterior JSONB,
    valor_nuevo JSONB,
    motivo TEXT,
    ip_address TEXT,
    user_agent TEXT
);
```

### Funciones RPC Críticas

#### `registrar_salida_fichaje`

```sql
CREATE FUNCTION registrar_salida_fichaje(p_fichaje_id UUID)
RETURNS TABLE (
    id UUID,
    empleado_id TEXT,
    fecha DATE,
    hora_entrada TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    horas_trabajadas DECIMAL(5,2),
    horas_totales DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fichaje RECORD;
BEGIN
    UPDATE fichajes
    SET hora_salida = now()
    WHERE fichajes.id = p_fichaje_id
    AND hora_salida IS NULL
    RETURNING * INTO v_fichaje;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fichaje no encontrado o ya tiene hora de salida';
    END IF;

    RETURN QUERY SELECT
        v_fichaje.id,
        v_fichaje.empleado_id,
        v_fichaje.fecha,
        v_fichaje.hora_entrada,
        v_fichaje.hora_salida,
        v_fichaje.horas_trabajadas,
        v_fichaje.horas_totales;
END;
$$;
```

#### `finalizar_pausa_fichaje`

```sql
CREATE FUNCTION finalizar_pausa_fichaje(p_pausa_id UUID)
RETURNS TABLE (
    id UUID,
    fichaje_id UUID,
    tipo TEXT,
    inicio TIMESTAMPTZ,
    fin TIMESTAMPTZ,
    duracion_minutos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pausa RECORD;
BEGIN
    UPDATE fichajes_pausas
    SET fin = now(),
        duracion_minutos = EXTRACT(EPOCH FROM (now() - inicio)) / 60
    WHERE fichajes_pausas.id = p_pausa_id
    AND fin IS NULL
    RETURNING * INTO v_pausa;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pausa no encontrada o ya finalizada';
    END IF;

    RETURN QUERY SELECT
        v_pausa.id,
        v_pausa.fichaje_id,
        v_pausa.tipo,
        v_pausa.inicio,
        v_pausa.fin,
        v_pausa.duracion_minutos;
END;
$$;
```

### Triggers Automáticos

#### Calcular Horas Trabajadas

```sql
CREATE OR REPLACE FUNCTION calcular_horas_trabajadas()
RETURNS TRIGGER AS $$
DECLARE
    horas_calculadas DECIMAL(5,2);
    minutos_pausas INTEGER;
BEGIN
    IF NEW.hora_salida IS NOT NULL AND NEW.hora_entrada IS NOT NULL THEN
        horas_calculadas := EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_entrada)) / 3600.0;

        SELECT COALESCE(SUM(duracion_minutos), 0) INTO minutos_pausas
        FROM fichajes_pausas
        WHERE fichaje_id = NEW.id AND fin IS NOT NULL;

        horas_calculadas := horas_calculadas - (minutos_pausas / 60.0);

        NEW.horas_trabajadas := ROUND(horas_calculadas, 2);
        NEW.horas_totales := ROUND(EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_entrada)) / 3600.0, 2);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calcular_horas_trabajadas
    BEFORE INSERT OR UPDATE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION calcular_horas_trabajadas();
```

---

## Servicios Backend

### 1. `fichajeSupabaseService.js`

**Ubicación:** `src/services/fichajeSupabaseService.js`

```javascript
import { supabase } from "../config/supabase";

class FichajeSupabaseService {
  // ===== OPERACIONES CRUD BÁSICAS =====

  async crearFichajeEntrada(empleadoId, fecha, userId = null) {
    try {
      const { data, error } = await supabase
        .from("fichajes")
        .insert({
          empleado_id: empleadoId,
          fecha: fecha.toISOString().split("T")[0],
          hora_entrada: null, // El trigger usará now()
          created_by: userId,
          es_modificado: false,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error("Error creando fichaje:", error);
      return { success: false, error: error.message };
    }
  }

  async registrarSalida(fichajeId) {
    try {
      const { data, error } = await supabase.rpc("registrar_salida_fichaje", {
        p_fichaje_id: fichajeId,
      });

      if (error) throw error;
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error("Error registrando salida:", error);
      return { success: false, error: error.message };
    }
  }

  async obtenerFichajeDia(empleadoId, fecha = new Date()) {
    try {
      const fechaStr = fecha.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("fichajes")
        .select("*")
        .eq("empleado_id", empleadoId)
        .eq("fecha", fechaStr)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return { success: true, data: data || null };
    } catch (error) {
      console.error("Error obteniendo fichaje del día:", error);
      return { success: false, error: error.message };
    }
  }

  async obtenerFichajesPendientes(empleadoId) {
    try {
      const { data, error } = await supabase
        .from("fichajes")
        .select("*")
        .eq("empleado_id", empleadoId)
        .is("hora_salida", null)
        .order("fecha", { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error("Error obteniendo fichajes pendientes:", error);
      return { success: false, error: error.message, data: [] };
    }
  }

  // ===== GESTIÓN DE PAUSAS =====

  async iniciarPausa(fichajeId, tipo = "descanso", descripcion = null) {
    try {
      const { data, error } = await supabase
        .from("fichajes_pausas")
        .insert({
          fichaje_id: fichajeId,
          tipo: tipo,
          inicio: null, // El trigger usará now()
          descripcion: descripcion,
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error("Error iniciando pausa:", error);
      return { success: false, error: error.message };
    }
  }

  async finalizarPausa(pausaId) {
    try {
      const { data, error } = await supabase.rpc("finalizar_pausa_fichaje", {
        p_pausa_id: pausaId,
      });

      if (error) throw error;
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error("Error finalizando pausa:", error);
      return { success: false, error: error.message };
    }
  }

  async obtenerPausas(fichajeId) {
    try {
      const { data, error } = await supabase
        .from("fichajes_pausas")
        .select("*")
        .eq("fichaje_id", fichajeId)
        .order("inicio", { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error("Error obteniendo pausas:", error);
      return { success: false, error: error.message };
    }
  }

  async obtenerPausaActiva(fichajeId) {
    try {
      const { data, error } = await supabase
        .from("fichajes_pausas")
        .select("*")
        .eq("fichaje_id", fichajeId)
        .is("fin", null)
        .order("inicio", { ascending: false })
        .limit(1);

      if (error) throw error;
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error("Error obteniendo pausa activa:", error);
      return { success: false, error: error.message };
    }
  }

  // ===== HISTORIAL Y REPORTES =====

  async obtenerFichajesEmpleado(empleadoId, fechaInicio, fechaFin) {
    try {
      const { data, error } = await supabase
        .from("fichajes")
        .select("*")
        .eq("empleado_id", empleadoId)
        .gte("fecha", fechaInicio.toISOString().split("T")[0])
        .lte("fecha", fechaFin.toISOString().split("T")[0])
        .order("fecha", { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error("Error obteniendo fichajes del empleado:", error);
      return { success: false, error: error.message };
    }
  }
}

const fichajeSupabaseService = new FichajeSupabaseService();
export default fichajeSupabaseService;
```

### 2. `fichajeService.js`

**Ubicación:** `src/services/fichajeService.js`

```javascript
import fichajeSupabaseService from "./fichajeSupabaseService";

class FichajeService {
  async ficharEntrada(empleadoId, userId) {
    try {
      const hoy = new Date();

      // Verificar si ya fichó hoy
      const { data: fichajeExistente } =
        await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);

      if (fichajeExistente) {
        return {
          success: false,
          error: "Ya has fichado la entrada hoy",
          data: fichajeExistente,
        };
      }

      // Cerrar fichajes pendientes antes de crear uno nuevo
      await this.verificarYcerrarFichajesOlvidados(empleadoId);

      // Crear nuevo fichaje
      const resultado = await fichajeSupabaseService.crearFichajeEntrada(
        empleadoId,
        hoy,
        userId,
      );

      if (!resultado.success) return resultado;

      return {
        success: true,
        message: "Entrada registrada correctamente",
        data: resultado.data,
      };
    } catch (error) {
      console.error("Error en ficharEntrada:", error);
      return {
        success: false,
        error: error.message || "Error al registrar la entrada",
      };
    }
  }

  async ficharSalida(empleadoId, userId) {
    try {
      const hoy = new Date();
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(
        empleadoId,
        hoy,
      );

      if (!fichaje) {
        return { success: false, error: "No has fichado la entrada hoy" };
      }

      if (fichaje.hora_salida) {
        return {
          success: false,
          error: "Ya has fichado la salida hoy",
          data: fichaje,
        };
      }

      // Verificar pausas activas
      const { data: pausaActiva } =
        await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);

      if (pausaActiva) {
        return {
          success: false,
          error:
            "Tienes una pausa activa. Finaliza la pausa antes de fichar la salida",
        };
      }

      const resultado = await fichajeSupabaseService.registrarSalida(
        fichaje.id,
      );

      if (!resultado.success) return resultado;

      return {
        success: true,
        message: "Salida registrada correctamente",
        data: resultado.data,
      };
    } catch (error) {
      console.error("Error en ficharSalida:", error);
      return {
        success: false,
        error: error.message || "Error al registrar la salida",
      };
    }
  }

  async iniciarPausa(empleadoId, tipo = "descanso", descripcion = null) {
    try {
      const hoy = new Date();
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(
        empleadoId,
        hoy,
      );

      if (!fichaje) {
        return { success: false, error: "No has fichado la entrada hoy" };
      }

      if (fichaje.hora_salida) {
        return {
          success: false,
          error: "Ya has fichado la salida. No puedes iniciar una pausa",
        };
      }

      const { data: pausaActiva } =
        await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);

      if (pausaActiva) {
        return {
          success: false,
          error:
            "Ya tienes una pausa activa. Finaliza la pausa actual antes de iniciar otra",
        };
      }

      const resultado = await fichajeSupabaseService.iniciarPausa(
        fichaje.id,
        tipo,
        descripcion,
      );

      if (!resultado.success) return resultado;

      return {
        success: true,
        message: `Pausa de ${tipo} iniciada`,
        data: resultado.data,
      };
    } catch (error) {
      console.error("Error en iniciarPausa:", error);
      return {
        success: false,
        error: error.message || "Error al iniciar la pausa",
      };
    }
  }

  async finalizarPausa(empleadoId) {
    try {
      const hoy = new Date();
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(
        empleadoId,
        hoy,
      );

      if (!fichaje) {
        return { success: false, error: "No has fichado la entrada hoy" };
      }

      const { data: pausaActiva } =
        await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);

      if (!pausaActiva) {
        return { success: false, error: "No tienes ninguna pausa activa" };
      }

      const resultado = await fichajeSupabaseService.finalizarPausa(
        pausaActiva.id,
      );

      if (!resultado.success) return resultado;

      return {
        success: true,
        message: "Pausa finalizada correctamente",
        data: resultado.data,
      };
    } catch (error) {
      console.error("Error en finalizarPausa:", error);
      return {
        success: false,
        error: error.message || "Error al finalizar la pausa",
      };
    }
  }

  async obtenerEstadoFichaje(empleadoId) {
    try {
      const hoy = new Date();

      // Verificar y cerrar fichajes olvidados
      await this.verificarYcerrarFichajesOlvidados(empleadoId);

      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(
        empleadoId,
        hoy,
      );

      if (!fichaje) {
        return {
          success: true,
          data: {
            tieneFichaje: false,
            puedeFicharEntrada: true,
            puedeFicharSalida: false,
            puedeIniciarPausa: false,
            puedeFinalizarPausa: false,
            pausaActiva: null,
          },
        };
      }

      const { data: pausas } = await fichajeSupabaseService.obtenerPausas(
        fichaje.id,
      );
      const { data: pausaActiva } =
        await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);

      return {
        success: true,
        data: {
          tieneFichaje: true,
          fichaje: fichaje,
          puedeFicharEntrada: false,
          puedeFicharSalida: !fichaje.hora_salida && !pausaActiva,
          puedeIniciarPausa: !fichaje.hora_salida && !pausaActiva,
          puedeFinalizarPausa: !!pausaActiva,
          pausaActiva: pausaActiva,
          pausas: pausas || [],
        },
      };
    } catch (error) {
      console.error("Error en obtenerEstadoFichaje:", error);
      return {
        success: false,
        error: error.message || "Error al obtener el estado del fichaje",
      };
    }
  }

  async verificarYcerrarFichajesOlvidados(empleadoId) {
    try {
      const ahora = new Date();
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const { data: fichajesPendientes } =
        await fichajeSupabaseService.obtenerFichajesPendientes(empleadoId);

      if (!fichajesPendientes || fichajesPendientes.length === 0) return;

      for (const fichaje of fichajesPendientes) {
        const { data: pausaActiva } =
          await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
        if (pausaActiva) continue;

        const fechaFichaje = new Date(fichaje.fecha);
        fechaFichaje.setHours(0, 0, 0, 0);
        const esHoy = fechaFichaje.getTime() === hoy.getTime();

        if (esHoy && fichaje.hora_entrada) {
          const horaEntrada = new Date(fichaje.hora_entrada);
          const horasAbierto = (ahora - horaEntrada) / (1000 * 60 * 60);

          if (horasAbierto >= 14) {
            await fichajeSupabaseService.cerrarFichajeAutomaticamente(
              fichaje.id,
              `Cerrado automáticamente: llevaba ${horasAbierto.toFixed(2)} horas abierto`,
            );
          }
        } else if (fechaFichaje < hoy) {
          await fichajeSupabaseService.cerrarFichajeAutomaticamente(
            fichaje.id,
            "Cerrado automáticamente: fichaje de día anterior sin salida",
          );
        }
      }
    } catch (error) {
      console.error("Error verificando fichajes olvidados:", error);
    }
  }

  formatearHoras(horas) {
    if (!horas && horas !== 0) return "0h";

    const horasEnteras = Math.floor(horas);
    const minutos = Math.round((horas - horasEnteras) * 60);

    if (minutos === 0) return `${horasEnteras}h`;
    return `${horasEnteras}h ${minutos}m`;
  }
}

const fichajeService = new FichajeService();
export default fichajeService;
```

### 3. `fichajeCodigosService.js`

**Ubicación:** `src/services/fichajeCodigosService.js`

```javascript
import { supabase } from "../config/supabase";

class FichajeCodigosService {
  async buscarEmpleadoPorCodigo(codigo) {
    try {
      if (!codigo || !codigo.trim()) {
        return { success: false, error: "El código no puede estar vacío" };
      }

      const codigoLimpio = codigo.trim().toUpperCase();

      const { data, error } = await supabase
        .from("fichajes_codigos")
        .select("*, empleado_id")
        .eq("codigo", codigoLimpio)
        .eq("activo", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: "Código no encontrado o no válido" };
        }
        throw error;
      }

      if (!data) {
        return { success: false, error: "Código no encontrado" };
      }

      return {
        success: true,
        data: {
          codigo: data.codigo,
          empleadoId: data.empleado_id,
          descripcion: data.descripcion,
        },
      };
    } catch (error) {
      console.error("Error buscando empleado por código:", error);
      return {
        success: false,
        error: error.message || "Error al buscar el código",
      };
    }
  }
}

export default new FichajeCodigosService();
```

---

## Componentes UI

### Componente Principal: `FichajePage.jsx`

**Ubicación:** `src/components/FichajePage.jsx`

**Estructura del componente:**

```jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, LogIn, LogOut, Coffee, Pause, Plus } from "lucide-react";
import fichajeService from "../services/fichajeService";
import fichajeSupabaseService from "../services/fichajeSupabaseService";
import fichajeCodigosService from "../services/fichajeCodigosService";
import { formatTimeMadrid, formatDateMadrid } from "../utils/timeUtils";
import { useAuth } from "./AuthContext";

const FichajePage = () => {
  const { user } = useAuth();

  // Estados principales
  const [empleadoId, setEmpleadoId] = useState(null);
  const [empleadoInfo, setEmpleadoInfo] = useState(null);
  const [codigoFichaje, setCodigoFichaje] = useState("");
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [estadoFichaje, setEstadoFichaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Historial
  const [historial, setHistorial] = useState([]);
  const [resumenMensual, setResumenMensual] = useState(null);

  // Validar código de fichaje
  const validarCodigo = async (codigo) => {
    if (!codigo || !codigo.trim()) {
      setError("Por favor, introduce un código");
      return;
    }

    setValidandoCodigo(true);
    setError("");

    try {
      const resultado =
        await fichajeCodigosService.buscarEmpleadoPorCodigo(codigo);

      if (resultado.success) {
        setEmpleadoId(resultado.data.empleadoId);
        setEmpleadoInfo({
          id: resultado.data.empleadoId,
          nombreCompleto: "Empleado",
          codigo: resultado.data.codigo,
        });
        setSuccess("Código válido");
        setTimeout(() => setSuccess(""), 2000);
      } else {
        setError(resultado.error || "Código no válido");
        setEmpleadoId(null);
        setEmpleadoInfo(null);
      }
    } catch (err) {
      console.error("Error validando código:", err);
      setError("Error al validar el código");
      setEmpleadoId(null);
      setEmpleadoInfo(null);
    } finally {
      setValidandoCodigo(false);
    }
  };

  // Cargar estado del fichaje
  const loadEstadoFichaje = async () => {
    if (!empleadoId) return;

    setLoading(true);
    try {
      const resultado = await fichajeService.obtenerEstadoFichaje(empleadoId);

      if (resultado.success) {
        setEstadoFichaje(resultado.data);
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error("Error al cargar el estado del fichaje:", err);
      setError("Error al cargar el estado del fichaje");
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial mensual
  const loadHistorial = async () => {
    if (!empleadoId) return;

    try {
      const hoy = new Date();
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

      const resultado = await fichajeSupabaseService.obtenerFichajesEmpleado(
        empleadoId,
        primerDia,
        ultimoDia,
      );

      if (resultado.success) {
        setHistorial(resultado.data || []);

        const resumen = resultado.data.reduce(
          (acc, fichaje) => {
            acc.totalDias++;
            acc.totalHoras += fichaje.horas_trabajadas || 0;
            if (fichaje.hora_salida) acc.diasCompletos++;
            else acc.diasIncompletos++;
            return acc;
          },
          { totalDias: 0, totalHoras: 0, diasCompletos: 0, diasIncompletos: 0 },
        );

        setResumenMensual(resumen);
      }
    } catch (err) {
      console.error("Error cargando historial:", err);
    }
  };

  useEffect(() => {
    if (empleadoId) {
      loadEstadoFichaje();
      loadHistorial();

      // Recargar cada 30 segundos
      const interval = setInterval(() => {
        loadEstadoFichaje();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [empleadoId]);

  // Handlers de acciones
  const handleFicharEntrada = async () => {
    setLoading(true);
    setError("");
    try {
      const resultado = await fichajeService.ficharEntrada(
        empleadoId,
        user?.id,
      );

      if (resultado.success) {
        setSuccess("Entrada registrada correctamente");
        setTimeout(() => setSuccess(""), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError("Error al registrar la entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleFicharSalida = async () => {
    setLoading(true);
    setError("");
    try {
      const resultado = await fichajeService.ficharSalida(empleadoId, user?.id);
      if (resultado.success) {
        setSuccess("Salida registrada correctamente");
        setTimeout(() => setSuccess(""), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError("Error al registrar la salida");
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarPausa = async (tipo = "descanso") => {
    setLoading(true);
    setError("");
    try {
      const resultado = await fichajeService.iniciarPausa(empleadoId, tipo);
      if (resultado.success) {
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(""), 3000);
        await loadEstadoFichaje();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError("Error al iniciar la pausa");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarPausa = async () => {
    setLoading(true);
    setError("");
    try {
      const resultado = await fichajeService.finalizarPausa(empleadoId);
      if (resultado.success) {
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(""), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError("Error al finalizar la pausa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* UI Components aquí */}
    </div>
  );
};

export default FichajePage;
```

---

## Utilidades

### `timeUtils.js`

**Ubicación:** `src/utils/timeUtils.js`

```javascript
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

const TIMEZONE_MADRID = "Europe/Madrid";

function parseDateAsUTC(dateString) {
  if (
    dateString.includes("Z") ||
    dateString.includes("+") ||
    dateString.includes("-", 10)
  ) {
    return new Date(dateString);
  }

  const utcString = dateString.endsWith("Z") ? dateString : dateString + "Z";
  return new Date(utcString);
}

export function formatTimeMadrid(dateString) {
  if (!dateString) return "N/A";

  try {
    const date =
      typeof dateString === "string" ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, "HH:mm", { locale: es });
  } catch (error) {
    console.error("Error formateando hora:", error);
    return "N/A";
  }
}

export function formatDateMadrid(dateString) {
  if (!dateString) return "N/A";

  try {
    const date =
      typeof dateString === "string" ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, "d MMM", { locale: es });
  } catch (error) {
    console.error("Error formateando fecha:", error);
    return "N/A";
  }
}

export function formatDateTimeMadrid(dateString) {
  if (!dateString) return "N/A";

  try {
    const date =
      typeof dateString === "string" ? parseDateAsUTC(dateString) : dateString;
    return formatInTimeZone(date, TIMEZONE_MADRID, "d MMM yyyy, HH:mm", {
      locale: es,
    });
  } catch (error) {
    console.error("Error formateando fecha y hora:", error);
    return "N/A";
  }
}
```

**Dependencias necesarias:**

```bash
npm install date-fns date-fns-tz
```

---

## Flujos de Trabajo

### 1. Flujo de Fichaje de Entrada

1. Usuario introduce código de fichaje
2. Sistema valida código en `fichajes_codigos`
3. Sistema verifica que no exista fichaje para hoy
4. Sistema cierra automáticamente fichajes pendientes (> 14 horas o días anteriores)
5. Sistema crea nuevo fichaje con `hora_entrada = now()` (servidor)
6. Trigger automático registra en auditoría

### 2. Flujo de Fichaje de Salida

1. Usuario hace clic en "Fichar Salida"
2. Sistema verifica que existe fichaje activo hoy
3. Sistema verifica que no hay pausas activas
4. Sistema llama a función RPC `registrar_salida_fichaje`
5. Función actualiza `hora_salida = now()` (servidor)
6. Trigger calcula automáticamente horas trabajadas (restando pausas)
7. Trigger registra en auditoría

### 3. Flujo de Pausas

**Iniciar Pausa:**

1. Usuario selecciona tipo de pausa (comida/descanso)
2. Sistema verifica que hay fichaje activo
3. Sistema verifica que no hay otra pausa activa
4. Sistema crea registro en `fichajes_pausas` con `inicio = now()`

**Finalizar Pausa:**

1. Usuario hace clic en "Finalizar Pausa"
2. Sistema llama a función RPC `finalizar_pausa_fichaje`
3. Función actualiza `fin = now()` y calcula `duracion_minutos`
4. Al fichar salida, trigger recalcula horas restando pausas

### 4. Cierre Automático de Fichajes Olvidados

- **Ejecutado en:** Cada vez que se carga el estado del fichaje
- **Lógica:**
  - Si fichaje del día actual lleva > 14 horas abierto → cerrar automáticamente
  - Si fichaje es de día anterior sin salida → cerrar automáticamente
  - Marca como `es_modificado = true` y guarda motivo en `valor_original`

---

## Configuración de Supabase

### Archivo de Configuración

**Ubicación:** `src/config/supabase.js`

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Variables de Entorno

Crear archivo `.env`:

```env
REACT_APP_SUPABASE_URL=https://tu-proyecto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=tu-anon-key
```

---

## Dependencias del Proyecto

```json
{
  "dependencies": {
    "react": "^18.x",
    "@supabase/supabase-js": "^2.x",
    "date-fns": "^2.x",
    "date-fns-tz": "^2.x",
    "framer-motion": "^10.x",
    "lucide-react": "^0.x"
  }
}
```

Instalar con:

```bash
npm install @supabase/supabase-js date-fns date-fns-tz framer-motion lucide-react
```

---

## Checklist de Implementación

### Base de Datos

- [ ] Crear tabla `fichajes` con todos sus campos
- [ ] Crear tabla `fichajes_pausas`
- [ ] Crear tabla `fichajes_codigos`
- [ ] Crear tabla `fichajes_auditoria`
- [ ] Crear índices en todas las tablas
- [ ] Crear función RPC `registrar_salida_fichaje`
- [ ] Crear función RPC `finalizar_pausa_fichaje`
- [ ] Crear triggers para calcular horas automáticamente
- [ ] Crear triggers para auditoría automática
- [ ] Configurar Row Level Security (RLS)

### Servicios

- [ ] Crear `fichajeSupabaseService.js` con todos los métodos CRUD
- [ ] Crear `fichajeService.js` con lógica de negocio
- [ ] Crear `fichajeCodigosService.js` para validación de códigos
- [ ] Configurar cliente de Supabase en `src/config/supabase.js`

### UI Components

- [ ] Crear componente `FichajePage.jsx`
- [ ] Implementar input de código de fichaje
- [ ] Implementar botones de entrada/salida
- [ ] Implementar gestión de pausas (inicio/fin)
- [ ] Implementar visualización de estado actual
- [ ] Implementar historial mensual
- [ ] Implementar resumen de horas trabajadas

### Utilidades

- [ ] Crear `timeUtils.js` con funciones de formateo de fecha/hora
- [ ] Integrar `date-fns-tz` para zona horaria de Madrid

### Integración

- [ ] Conectar componente con servicios
- [ ] Conectar servicios con Supabase
- [ ] Probar flujo completo de fichaje
- [ ] Verificar cálculo automático de horas
- [ ] Verificar cierre automático de fichajes olvidados

---

## Notas Importantes

> **⚠️ CRÍTICO:** Todas las horas deben usar `now()` del servidor de Supabase, NUNCA la hora del dispositivo del usuario. Esto previene manipulación de fichajes.

> **⚠️ ZONA HORARIA:** El sistema usa `Europe/Madrid` como zona horaria. Todos los timestamps se guardan en UTC en la base de datos y se convierten a hora de Madrid en el frontend.

> **⚠️ SEGURIDAD:** Las funciones RPC usan `SECURITY DEFINER` para ejecutarse con permisos de la base de datos, no del usuario. Esto es necesario para garantizar que `now()` use la hora del servidor.

> **📊 AUDITORÍA:** Todos los cambios en fichajes se registran automáticamente en `fichajes_auditoria` mediante triggers. Este historial NO se puede borrar ni modificar.

> **🔒 VALIDACIÓN:** El sistema valida que:
>
> - No se puede fichar entrada dos veces el mismo día
> - No se puede fichar salida sin haber fichado entrada
> - No se puede fichar salida con pausa activa
> - No se pueden tener dos pausas activas simultáneamente

---

## Siguiente Paso

Una vez implementado el sistema según estas instrucciones, el fichaje funcionará **exactamente igual** que en la aplicación de escritorio, pero accesible desde la web usando la **misma base de datos de Supabase**.
