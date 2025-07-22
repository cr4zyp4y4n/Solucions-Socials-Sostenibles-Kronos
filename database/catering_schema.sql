-- =====================================================
-- ESQUEMA DE BASE DE DATOS PARA MÓDULO DE CATERING
-- =====================================================

-- Tabla principal de eventos de catering
CREATE TABLE IF NOT EXISTS catering_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    client_email VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location TEXT NOT NULL,
    guests INTEGER NOT NULL,
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
    status VARCHAR(20) DEFAULT 'recibido' CHECK (status IN ('recibido', 'aceptado', 'en_preparacion', 'finalizado', 'rechazado')),
    budget_id UUID REFERENCES catering_budgets(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Tabla de presupuestos
CREATE TABLE IF NOT EXISTS catering_budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviado', 'aceptado', 'rechazado')),
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Tabla de items del presupuesto
CREATE TABLE IF NOT EXISTS catering_budget_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_id UUID REFERENCES catering_budgets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de menús y alimentación
CREATE TABLE IF NOT EXISTS catering_menus (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    appetizers JSONB,
    main_courses JSONB,
    desserts JSONB,
    beverages JSONB,
    special_requirements JSONB,
    dietary_restrictions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de logística
CREATE TABLE IF NOT EXISTS catering_logistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    service_type VARCHAR(50) DEFAULT 'completo' CHECK (service_type IN ('completo', 'parcial', 'solo_catering')),
    duration VARCHAR(50),
    setup_time VARCHAR(50),
    cleanup_time VARCHAR(50),
    staff_required INTEGER,
    vehicles INTEGER,
    delivery_time TIME,
    setup_requirements JSONB,
    equipment JSONB,
    parking_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de personal asignado
CREATE TABLE IF NOT EXISTS catering_staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS catering_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    order_type VARCHAR(50) CHECK (order_type IN ('interno', 'proveedor')),
    supplier_name VARCHAR(255),
    supplier_contact VARCHAR(255),
    total_amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado', 'entregado', 'cancelado')),
    order_date DATE NOT NULL,
    delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Tabla de items de pedidos
CREATE TABLE IF NOT EXISTS catering_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES catering_orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    received BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Tabla de checklists
CREATE TABLE IF NOT EXISTS catering_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    checklist_type VARCHAR(50) CHECK (checklist_type IN ('preparacion', 'retorno')),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(100),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES auth.users(id),
    priority VARCHAR(20) DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de hojas de ruta
CREATE TABLE IF NOT EXISTS catering_routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    departure_time TIME,
    arrival_time TIME,
    route_details JSONB,
    vehicle_info JSONB,
    driver_info JSONB,
    contact_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones de catering
CREATE TABLE IF NOT EXISTS catering_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES catering_events(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- ÍNDICES PARA OPTIMIZAR CONSULTAS
-- =====================================================

-- Índices para catering_events
CREATE INDEX IF NOT EXISTS idx_catering_events_date ON catering_events(date);
CREATE INDEX IF NOT EXISTS idx_catering_events_status ON catering_events(status);
CREATE INDEX IF NOT EXISTS idx_catering_events_client_name ON catering_events(client_name);
CREATE INDEX IF NOT EXISTS idx_catering_events_created_by ON catering_events(created_by);

-- Índices para catering_budgets
CREATE INDEX IF NOT EXISTS idx_catering_budgets_event_id ON catering_budgets(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_budgets_status ON catering_budgets(status);
CREATE INDEX IF NOT EXISTS idx_catering_budgets_created_at ON catering_budgets(created_at);

-- Índices para catering_orders
CREATE INDEX IF NOT EXISTS idx_catering_orders_event_id ON catering_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_orders_status ON catering_orders(status);
CREATE INDEX IF NOT EXISTS idx_catering_orders_delivery_date ON catering_orders(delivery_date);

-- Índices para catering_checklists
CREATE INDEX IF NOT EXISTS idx_catering_checklists_event_id ON catering_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_checklists_type ON catering_checklists(checklist_type);
CREATE INDEX IF NOT EXISTS idx_catering_checklists_completed ON catering_checklists(completed);

-- Índices para catering_notifications
CREATE INDEX IF NOT EXISTS idx_catering_notifications_event_id ON catering_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_notifications_read_at ON catering_notifications(read_at);

-- =====================================================
-- FUNCIONES Y TRIGGERS
-- =====================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_catering_events_updated_at BEFORE UPDATE ON catering_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catering_budgets_updated_at BEFORE UPDATE ON catering_budgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catering_logistics_updated_at BEFORE UPDATE ON catering_logistics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catering_orders_updated_at BEFORE UPDATE ON catering_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catering_routes_updated_at BEFORE UPDATE ON catering_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular total_price en budget_items
CREATE OR REPLACE FUNCTION calculate_budget_item_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.quantity * NEW.unit_price;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para calcular total_price automáticamente
CREATE TRIGGER calculate_budget_item_total_trigger BEFORE INSERT OR UPDATE ON catering_budget_items
    FOR EACH ROW EXECUTE FUNCTION calculate_budget_item_total();

-- Función para calcular total_amount en budgets
CREATE OR REPLACE FUNCTION update_budget_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE catering_budgets 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM catering_budget_items 
        WHERE budget_id = NEW.budget_id
    )
    WHERE id = NEW.budget_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar total_amount del presupuesto
CREATE TRIGGER update_budget_total_insert AFTER INSERT ON catering_budget_items
    FOR EACH ROW EXECUTE FUNCTION update_budget_total();

CREATE TRIGGER update_budget_total_update AFTER UPDATE ON catering_budget_items
    FOR EACH ROW EXECUTE FUNCTION update_budget_total();

CREATE TRIGGER update_budget_total_delete AFTER DELETE ON catering_budget_items
    FOR EACH ROW EXECUTE FUNCTION update_budget_total();

-- =====================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE catering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para catering_events
CREATE POLICY "Users can view catering events" ON catering_events
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert catering events" ON catering_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update catering events" ON catering_events
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete catering events" ON catering_events
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para catering_budgets
CREATE POLICY "Users can view catering budgets" ON catering_budgets
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert catering budgets" ON catering_budgets
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update catering budgets" ON catering_budgets
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete catering budgets" ON catering_budgets
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para catering_orders
CREATE POLICY "Users can view catering orders" ON catering_orders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert catering orders" ON catering_orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update catering orders" ON catering_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete catering orders" ON catering_orders
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para catering_checklists
CREATE POLICY "Users can view catering checklists" ON catering_checklists
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert catering checklists" ON catering_checklists
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update catering checklists" ON catering_checklists
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete catering checklists" ON catering_checklists
    FOR DELETE USING (auth.role() = 'authenticated');

-- Políticas para el resto de tablas (similar estructura)
-- catering_budget_items
CREATE POLICY "Users can view budget items" ON catering_budget_items
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert budget items" ON catering_budget_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update budget items" ON catering_budget_items
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete budget items" ON catering_budget_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_menus
CREATE POLICY "Users can view menus" ON catering_menus
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert menus" ON catering_menus
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update menus" ON catering_menus
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete menus" ON catering_menus
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_logistics
CREATE POLICY "Users can view logistics" ON catering_logistics
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert logistics" ON catering_logistics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update logistics" ON catering_logistics
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete logistics" ON catering_logistics
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_staff
CREATE POLICY "Users can view staff" ON catering_staff
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert staff" ON catering_staff
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update staff" ON catering_staff
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete staff" ON catering_staff
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_order_items
CREATE POLICY "Users can view order items" ON catering_order_items
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert order items" ON catering_order_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update order items" ON catering_order_items
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete order items" ON catering_order_items
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_routes
CREATE POLICY "Users can view routes" ON catering_routes
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert routes" ON catering_routes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update routes" ON catering_routes
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete routes" ON catering_routes
    FOR DELETE USING (auth.role() = 'authenticated');

-- catering_notifications
CREATE POLICY "Users can view notifications" ON catering_notifications
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert notifications" ON catering_notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update notifications" ON catering_notifications
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Users can delete notifications" ON catering_notifications
    FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================

-- Insertar algunos eventos de prueba
INSERT INTO catering_events (
    client_name, client_phone, client_email, event_type, date, time, location, guests, notes, priority, status
) VALUES 
('María García', '+34 600 123 456', 'maria.garcia@email.com', 'Boda', '2024-02-15', '19:00', 'Finca Los Olivos, Valencia', 120, 'Evento de boda con servicio completo. Cliente muy exigente con la presentación.', 'alta', 'aceptado'),
('Carlos Rodríguez', '+34 600 789 012', 'carlos.rodriguez@email.com', 'Cumpleaños', '2024-02-20', '14:00', 'Restaurante El Mirador, Madrid', 45, 'Cumpleaños de empresa con 45 personas.', 'media', 'recibido'),
('Ana López', '+34 600 345 678', 'ana.lopez@email.com', 'Evento Corporativo', '2024-02-25', '09:00', 'Hotel Plaza Mayor, Barcelona', 80, 'Evento corporativo con presentaciones y networking.', 'alta', 'en_preparacion')
ON CONFLICT DO NOTHING;

-- Insertar presupuestos de prueba
INSERT INTO catering_budgets (
    event_id, total_amount, status
) VALUES 
((SELECT id FROM catering_events WHERE client_name = 'María García' LIMIT 1), 8500, 'aceptado'),
((SELECT id FROM catering_events WHERE client_name = 'Carlos Rodríguez' LIMIT 1), 3200, 'enviado'),
((SELECT id FROM catering_events WHERE client_name = 'Ana López' LIMIT 1), 6500, 'borrador')
ON CONFLICT DO NOTHING;

-- Insertar items de presupuesto de prueba
INSERT INTO catering_budget_items (
    budget_id, name, description, quantity, unit_price, total_price, category
) VALUES 
((SELECT id FROM catering_budgets WHERE total_amount = 8500 LIMIT 1), 'Servicio de Catering Completo', 'Servicio completo incluyendo cocina, servicio y limpieza', 1, 5000, 5000, 'servicio'),
((SELECT id FROM catering_budgets WHERE total_amount = 8500 LIMIT 1), 'Personal de Servicio', '8 personas para servicio de mesa', 8, 150, 1200, 'personal'),
((SELECT id FROM catering_budgets WHERE total_amount = 8500 LIMIT 1), 'Equipamiento y Mobiliario', 'Mesas, sillas y equipamiento de cocina', 1, 800, 800, 'equipamiento'),
((SELECT id FROM catering_budgets WHERE total_amount = 8500 LIMIT 1), 'Transporte y Logística', 'Transporte de equipamiento y personal', 1, 500, 500, 'logistica'),
((SELECT id FROM catering_budgets WHERE total_amount = 8500 LIMIT 1), 'Decoración y Presentación', 'Decoración floral y presentación especial', 1, 1000, 1000, 'decoracion')
ON CONFLICT DO NOTHING; 