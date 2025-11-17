type ColumnType =
  | 'uuid'
  | 'text'
  | 'varchar'
  | 'timestamp'
  | 'boolean'
  | 'jsonb';

interface Column<TType = unknown> {
  dataType: ColumnType;
  optional?: boolean;
  defaultValue?: TType;
  references?: { table: string; column: string };
  description?: string;
}

export interface TableDefinition<TColumns extends Record<string, Column>> {
  name: string;
  primaryKey: keyof TColumns;
  columns: TColumns;
}

const column = <TType>(config: Column<TType>): Column<TType> => config;

export const clientsTable: TableDefinition<{
  id: Column<string>;
  user_id: Column<string>;
  name: Column<string>;
  organization: Column<string | null>;
  email: Column<string | null>;
  phone: Column<string | null>;
  address: Column<string | null>;
  created_at: Column<string>;
}> = {
  name: 'clients',
  primaryKey: 'id',
  columns: {
    id: column({ dataType: 'uuid' }),
    user_id: column({ dataType: 'uuid', description: 'Owner of the client record' }),
    name: column({ dataType: 'text', description: 'Primary client contact name' }),
    organization: column({ dataType: 'text', optional: true }),
    email: column({ dataType: 'text', optional: true }),
    phone: column({ dataType: 'varchar', optional: true }),
    address: column({ dataType: 'text', optional: true }),
    created_at: column({ dataType: 'timestamp' }),
  },
};

export const templatesTable: TableDefinition<{
  id: Column<string>;
  created_by: Column<string>;
  name: Column<string>;
  trade_type: Column<string>;
  is_public: Column<boolean>;
  items: Column<unknown>;
  created_at: Column<string>;
}> = {
  name: 'templates',
  primaryKey: 'id',
  columns: {
    id: column({ dataType: 'uuid' }),
    created_by: column({ dataType: 'uuid' }),
    name: column({ dataType: 'text' }),
    trade_type: column({ dataType: 'text' }),
    is_public: column({ dataType: 'boolean', defaultValue: false }),
    items: column({
      dataType: 'jsonb',
      description: 'Array of template items (id, label, required, photo)',
    }),
    created_at: column({ dataType: 'timestamp' }),
  },
};

export const jobsTable: TableDefinition<{
  id: Column<string>;
  user_id: Column<string>;
  client_id: Column<string>;
  client_name: Column<string>;
  address: Column<string>;
  title: Column<string>;
  status: Column<string>;
  template_id: Column<string>;
  scheduled_for: Column<string>;
  technician_name: Column<string>;
  notes: Column<string>;
  created_at: Column<string>;
}> = {
  name: 'jobs',
  primaryKey: 'id',
  columns: {
    id: column({ dataType: 'uuid' }),
    user_id: column({ dataType: 'uuid' }),
    client_id: column({
      dataType: 'uuid',
      references: { table: clientsTable.name, column: clientsTable.primaryKey as string },
    }),
    client_name: column({ dataType: 'text' }),
    address: column({ dataType: 'text', optional: true }),
    title: column({ dataType: 'text', optional: true }),
    status: column({ dataType: 'text', description: 'draft | active | awaiting_signatures | completed' }),
    template_id: column({
      dataType: 'uuid',
      references: { table: templatesTable.name, column: templatesTable.primaryKey as string },
      optional: true,
    }),
    scheduled_for: column({ dataType: 'timestamp', optional: true }),
    technician_name: column({ dataType: 'text', optional: true }),
    notes: column({ dataType: 'text', optional: true }),
    created_at: column({ dataType: 'timestamp' }),
  },
};

export const jobItemsTable: TableDefinition<{
  id: Column<string>;
  job_id: Column<string>;
  label: Column<string>;
  status: Column<string>;
  note: Column<string>;
  user_id: Column<string>;
  created_at: Column<string>;
}> = {
  name: 'job_checklist',
  primaryKey: 'id',
  columns: {
    id: column({ dataType: 'uuid' }),
    job_id: column({
      dataType: 'uuid',
      references: { table: jobsTable.name, column: jobsTable.primaryKey as string },
    }),
    label: column({ dataType: 'text' }),
    status: column({ dataType: 'text', description: 'pending | pass | fail' }),
    note: column({ dataType: 'text', optional: true }),
    user_id: column({ dataType: 'uuid' }),
    created_at: column({ dataType: 'timestamp' }),
  },
};

export const reportsTable: TableDefinition<{
  job_id: Column<string>;
  storage_path: Column<string>;
  generated_at: Column<string>;
}> = {
  name: 'reports',
  primaryKey: 'job_id',
  columns: {
    job_id: column({
      dataType: 'uuid',
      references: { table: jobsTable.name, column: jobsTable.primaryKey as string },
    }),
    storage_path: column({ dataType: 'text' }),
    generated_at: column({ dataType: 'timestamp' }),
  },
};

export const reportDeliveriesTable: TableDefinition<{
  id: Column<string>;
  job_id: Column<string>;
  recipient_email: Column<string>;
  recipient_name: Column<string>;
  status: Column<string>;
  storage_path: Column<string>;
  created_at: Column<string>;
  user_id: Column<string>;
}> = {
  name: 'report_deliveries',
  primaryKey: 'id',
  columns: {
    id: column({ dataType: 'uuid' }),
    job_id: column({
      dataType: 'uuid',
      references: { table: jobsTable.name, column: jobsTable.primaryKey as string },
    }),
    recipient_email: column({ dataType: 'text' }),
    recipient_name: column({ dataType: 'text', optional: true }),
    status: column({ dataType: 'text', defaultValue: 'queued' }),
    storage_path: column({ dataType: 'text', optional: true }),
    created_at: column({ dataType: 'timestamp' }),
    user_id: column({ dataType: 'uuid', optional: true }),
  },
};

export type ClientsTable = typeof clientsTable;
export type JobsTable = typeof jobsTable;
export type TemplatesTable = typeof templatesTable;
export type JobItemsTable = typeof jobItemsTable;
export type ReportsTable = typeof reportsTable;
export type ReportDeliveriesTable = typeof reportDeliveriesTable;
